import {
  createConnection,
  MarkupKind,
  ProposedFeatures,
  TextDocumentSyncKind,
  TextDocuments,
  type Connection,
  type CompletionItem,
  type Diagnostic,
  type DocumentSymbol,
  type Hover,
  type InitializeResult,
  type Location,
  type Range,
} from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';

import type { LanguageLocation } from '@abnt/language-service';
import type { WorkspaceFileId } from '@abnt/workspace-core';

import { completionKindToLsp, OUTLINE_SYMBOL_KIND, severityToLsp } from './mapping.js';
import { pathFromUri, uriFromPath } from './uri.js';
import { openWorkspace, type LspWorkspace } from './workspace.js';

/**
 * Adapter LSP sobre `@abnt/language-service` — não reimplementa outline,
 * diagnósticos, completions, hover, definição ou referências, só traduz o
 * contrato deste package para o protocolo LSP. Ver ADR 0018.
 *
 * Um processo, um vault: workspace único aberto em `onInitialize`. Múltiplas
 * raízes (`workspaceFolders` com mais de uma entrada) não são suportadas
 * nesta primeira fatia.
 *
 * Recebe os streams em vez de amarrar em `process.stdin`/`stdout` diretamente
 * para que o teste de integração (`tests/p13-lsp.test.ts`) fale o protocolo
 * real sobre um par de streams em memória, sem precisar de um subprocesso.
 */
export function createLspServer(input: NodeJS.ReadableStream, output: NodeJS.WritableStream): Connection {
  const connection = createConnection(ProposedFeatures.all, input, output);
  const documents = new TextDocuments(TextDocument);

  let workspace: LspWorkspace | undefined;

  /**
   * `TextDocuments` dispara `onDidOpen` e `onDidChangeContent` quase juntos
   * para a mesma abertura (abrir É uma mudança de conteúdo, de vazio para o
   * inicial). Sem essa memoização, o segundo handler chama `replaceContent`
   * antes do primeiro terminar `sessions.open()`, e a sessão ainda não existe.
   */
  const openSessions = new Map<string, Promise<void>>();

  function ensureOpen(fileId: WorkspaceFileId): Promise<void> {
    const key = String(fileId);
    let pending = openSessions.get(key);
    if (pending === undefined) {
      pending = workspace!.sessions.open(fileId).then(() => undefined);
      openSessions.set(key, pending);
    }
    return pending;
  }

  const fileIdFor = async (uri: string): Promise<WorkspaceFileId | undefined> => {
    if (workspace === undefined) return undefined;
    const path = pathFromUri(workspace.rootPath, uri);
    if (path === undefined) return undefined;
    const files = await workspace.storage.list();
    return files.find((file) => String(file.path) === String(path))?.id;
  };

  /** Documento aberto usa o buffer do cliente; fechado, lê do storage só para converter offset. */
  const documentFor = async (uri: string): Promise<TextDocument | undefined> => {
    const open = documents.get(uri);
    if (open !== undefined) return open;
    if (workspace === undefined) return undefined;
    const path = pathFromUri(workspace.rootPath, uri);
    if (path === undefined) return undefined;
    const files = await workspace.storage.list();
    const file = files.find((candidate) => String(candidate.path) === String(path));
    if (file === undefined) return undefined;
    const content = await workspace.storage.read(file.id);
    return TextDocument.create(uri, 'markdown', 0, content.content);
  };

  const toLocation = async (location: LanguageLocation): Promise<Location | undefined> => {
    if (workspace === undefined) return undefined;
    const uri = uriFromPath(workspace.rootPath, location.path);
    const doc = await documentFor(uri);
    if (doc === undefined) return undefined;
    return { uri, range: { start: doc.positionAt(location.range.start), end: doc.positionAt(location.range.end) } };
  };

  const publishDiagnostics = async (fileId: WorkspaceFileId, uri: string): Promise<void> => {
    if (workspace === undefined) return;
    const doc = await documentFor(uri);
    if (doc === undefined) return;
    const diagnostics = await workspace.language.diagnostics(fileId);
    const zero: Range = { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };
    connection.sendDiagnostics({
      uri,
      diagnostics: diagnostics.map(
        (diagnostic): Diagnostic => ({
          severity: severityToLsp(diagnostic.severity),
          range:
            diagnostic.source === undefined
              ? zero
              : { start: doc.positionAt(diagnostic.source.start.offset), end: doc.positionAt(diagnostic.source.end.offset) },
          message: diagnostic.message,
          source: 'abnt',
        }),
      ),
    });
  };

  connection.onInitialize(async (params): Promise<InitializeResult> => {
    const rootUri = params.workspaceFolders?.[0]?.uri ?? params.rootUri ?? undefined;
    if (rootUri !== null && rootUri !== undefined) {
      workspace = await openWorkspace(URI.parse(rootUri).fsPath);
      workspace.sessions.subscribe((event) => {
        if (event.type === 'session:closed' || workspace === undefined) return;
        const fileId = 'sessionId' in event ? event.sessionId : event.session.id;
        const snapshot = workspace.sessions.snapshot(fileId);
        if (snapshot === undefined) return;
        const uri = uriFromPath(workspace.rootPath, snapshot.file.path);
        if (documents.get(uri) === undefined) return; // só para documentos abertos no editor
        void publishDiagnostics(fileId, uri);
      });
    }

    return {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Full,
        documentSymbolProvider: true,
        hoverProvider: true,
        definitionProvider: true,
        referencesProvider: true,
        completionProvider: { triggerCharacters: ['@', '('] },
      },
    };
  });

  connection.onShutdown(async () => {
    await workspace?.dispose();
    workspace = undefined;
  });

  documents.onDidOpen(async (event) => {
    const fileId = await fileIdFor(event.document.uri);
    if (fileId === undefined || workspace === undefined) return;
    await ensureOpen(fileId);
    // Sincroniza com o buffer do cliente: pode ter conteúdo não salvo em disco.
    workspace.sessions.replaceContent(fileId, event.document.getText());
  });

  documents.onDidChangeContent(async (event) => {
    const fileId = await fileIdFor(event.document.uri);
    if (fileId === undefined || workspace === undefined) return;
    await ensureOpen(fileId);
    workspace.sessions.replaceContent(fileId, event.document.getText());
  });

  documents.onDidClose(async (event) => {
    const fileId = await fileIdFor(event.document.uri);
    if (fileId !== undefined) {
      workspace?.sessions.close(fileId);
      openSessions.delete(String(fileId));
    }
  });

  connection.onDocumentSymbol(async (params): Promise<DocumentSymbol[]> => {
    const fileId = await fileIdFor(params.textDocument.uri);
    const doc = documents.get(params.textDocument.uri);
    if (fileId === undefined || doc === undefined || workspace === undefined) return [];
    const outline = await workspace.language.outline(fileId);
    return outline.map((item): DocumentSymbol => {
      const range: Range = { start: doc.positionAt(item.range.start), end: doc.positionAt(item.range.end) };
      return { name: item.title, kind: OUTLINE_SYMBOL_KIND, range, selectionRange: range };
    });
  });

  connection.onHover(async (params): Promise<Hover | null> => {
    const fileId = await fileIdFor(params.textDocument.uri);
    const doc = documents.get(params.textDocument.uri);
    if (fileId === undefined || doc === undefined || workspace === undefined) return null;
    const hover = await workspace.language.hover({ fileId, offset: doc.offsetAt(params.position) });
    if (hover === undefined) return null;
    return {
      contents: { kind: MarkupKind.PlainText, value: hover.contents.join('\n') },
      range: { start: doc.positionAt(hover.range.start), end: doc.positionAt(hover.range.end) },
    };
  });

  connection.onDefinition(async (params): Promise<Location[]> => {
    const fileId = await fileIdFor(params.textDocument.uri);
    const doc = documents.get(params.textDocument.uri);
    if (fileId === undefined || doc === undefined || workspace === undefined) return [];
    const locations = await workspace.language.definition({ fileId, offset: doc.offsetAt(params.position) });
    const resolved = await Promise.all(locations.map(toLocation));
    return resolved.filter((location): location is Location => location !== undefined);
  });

  connection.onReferences(async (params): Promise<Location[]> => {
    const fileId = await fileIdFor(params.textDocument.uri);
    const doc = documents.get(params.textDocument.uri);
    if (fileId === undefined || doc === undefined || workspace === undefined) return [];
    const locations = await workspace.language.references({ fileId, offset: doc.offsetAt(params.position) });
    const resolved = await Promise.all(locations.map(toLocation));
    return resolved.filter((location): location is Location => location !== undefined);
  });

  connection.onCompletion(async (params): Promise<CompletionItem[]> => {
    const fileId = await fileIdFor(params.textDocument.uri);
    const doc = documents.get(params.textDocument.uri);
    if (fileId === undefined || doc === undefined || workspace === undefined) return [];
    const result = await workspace.language.completions({ fileId, offset: doc.offsetAt(params.position) });
    if (result === undefined) return [];
    return result.items.map(
      (item): CompletionItem => ({
        label: item.label,
        kind: completionKindToLsp(item.kind),
        insertText: item.insertText,
        ...(item.detail !== undefined ? { detail: item.detail } : {}),
      }),
    );
  });

  documents.listen(connection);
  connection.listen();
  return connection;
}
