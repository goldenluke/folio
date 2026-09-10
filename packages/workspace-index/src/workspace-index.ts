import { mkdir, rm } from 'node:fs/promises';
import { dirname } from 'node:path';

import Database from 'better-sqlite3';
import {
  percorrer,
  type DocumentAst,
  type InlineNode,
} from '@abnt/document-model';
import { parseMarkdownComDiagnosticos } from '@abnt/markdown';
import {
  asWorkspaceFileId,
  asWorkspacePath,
  isMarkdownPath,
  WorkspaceFileNotFoundError,
  type WorkspaceEvent,
  type WorkspaceFile,
  type WorkspaceFileId,
  type WorkspaceStorage,
} from '@abnt/workspace-core';

import { migrateWorkspaceIndex } from './migrations.js';
import type {
  IndexedBlock,
  IndexedBlockKind,
  IndexedCitation,
  IndexedCrossReference,
  IndexedDocumentTitle,
  IndexedHeading,
  IndexedIdentifier,
  IndexedIdentifierKind,
  IndexedLink,
  IndexedLinkKind,
  IndexedResource,
  IndexFingerprint,
  IndexSynchronizationResult,
  WorkspaceIndex,
  WorkspaceIndexOptions,
  WorkspaceIndexStats,
  WorkspaceSearchResult,
} from './model.js';

type SqliteDatabase = Database.Database;

interface IndexedFileRow {
  readonly file_id: string;
  readonly document_id: string | null;
  readonly path: string;
  readonly revision: number;
  readonly content_hash: string;
  readonly media_type: string | null;
  readonly is_markdown: number;
}

interface CountRow {
  readonly count: number;
}

const textOf = (nodes: readonly InlineNode[] | undefined): string => {
  if (nodes === undefined) return '';
  return nodes
    .map((node) => {
      switch (node.type) {
        case 'text':
        case 'code-inline':
        case 'math-inline':
          return node.value;
        case 'soft-break':
        case 'hard-break':
          return ' ';
        case 'emphasis':
        case 'strong':
        case 'strike':
        case 'link':
        case 'inline-container':
          return textOf(node.children);
        case 'citation':
          return node.items.map((item) => `@${item.referenceId}`).join(' ');
        case 'cross-reference':
        case 'note-reference':
          return '';
      }
    })
    .join(' ')
    .replace(/\s+/gu, ' ')
    .trim();
};

const linkKindFor = (target: string): IndexedLinkKind => {
  if (target.startsWith('#')) return 'anchor';
  return /^[a-z][a-z0-9+.-]*:/iu.test(target) || target.startsWith('//') ? 'external' : 'document';
};

const sourceOffsets = (source: { readonly start: { readonly offset: number }; readonly end: { readonly offset: number } } | undefined) =>
  source === undefined
    ? { start: null as number | null, end: null as number | null }
    : { start: source.start.offset, end: source.end.offset };

/** SQLite/FTS5 derivado do WorkspaceStorage; não é autoridade sobre o vault. */
export class SqliteWorkspaceIndex implements WorkspaceIndex {
  readonly #storage: WorkspaceStorage;
  readonly #databasePath: string;
  #connection: SqliteDatabase | undefined;
  #unsubscribe: (() => void) | undefined;
  #opened = false;
  #tail: Promise<void> = Promise.resolve();
  #lastError: unknown;

  constructor(options: WorkspaceIndexOptions) {
    this.#storage = options.storage;
    this.#databasePath = options.databasePath;
  }

  static create(options: WorkspaceIndexOptions): SqliteWorkspaceIndex {
    return new SqliteWorkspaceIndex(options);
  }

  async open(): Promise<IndexSynchronizationResult> {
    if (this.#opened) return this.synchronize();
    await this.#storage.open();
    await this.#openDatabase();
    this.#opened = true;
    this.#unsubscribe = this.#storage.subscribe((event) => {
      void this.#enqueue(() => this.#applyWorkspaceEvent(event));
    });
    return this.synchronize();
  }

  async close(): Promise<void> {
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
    await this.idle();
    this.#connection?.close();
    this.#connection = undefined;
    this.#opened = false;
  }

  async synchronize(): Promise<IndexSynchronizationResult> {
    this.#requireOpen();
    return this.#enqueue(async () => {
      await this.#storage.refresh();
      const files = await this.#storage.list();
      const existing = new Map(
        (this.#database().prepare('SELECT file_id, document_id, path, revision, content_hash, media_type, is_markdown FROM indexed_files').all() as IndexedFileRow[]).map(
          (row) => [row.file_id, row],
        ),
      );
      let indexed = 0;
      let skipped = 0;
      let removed = 0;

      for (const file of files) {
        const row = existing.get(String(file.id));
        existing.delete(String(file.id));
        if (row !== undefined && this.#matchesFingerprint(row, file)) {
          skipped += 1;
          continue;
        }
        await this.#indexFile(file);
        indexed += 1;
      }
      for (const row of existing.values()) {
        this.#deleteFile(asWorkspaceFileId(row.file_id));
        removed += 1;
      }
      return { indexed, skipped, removed };
    });
  }

  async rebuild(): Promise<IndexSynchronizationResult> {
    this.#requireOpen();
    await this.idle();
    this.#database().close();
    this.#connection = undefined;
    await Promise.all([
      rm(this.#databasePath, { force: true }),
      rm(`${this.#databasePath}-wal`, { force: true }),
      rm(`${this.#databasePath}-shm`, { force: true }),
    ]);
    await this.#openDatabase();
    return this.synchronize();
  }

  async idle(): Promise<void> {
    await this.#tail;
    if (this.#lastError !== undefined) {
      const error = this.#lastError;
      this.#lastError = undefined;
      throw error;
    }
  }

  stats(): WorkspaceIndexStats {
    const database = this.#database();
    const count = (table: string, condition = ''): number =>
      (database.prepare(`SELECT COUNT(*) AS count FROM ${table}${condition}`).get() as CountRow).count;
    return {
      schemaVersion: Number(database.pragma('user_version', { simple: true })),
      files: count('indexed_files'),
      markdownFiles: count('indexed_files', ' WHERE is_markdown = 1'),
      headings: count('indexed_headings'),
      links: count('indexed_links'),
      citations: count('indexed_citations'),
      resources: count('indexed_resources'),
      blocks: count('indexed_blocks'),
      identifiers: count('indexed_identifiers'),
      crossReferences: count('indexed_xrefs'),
    };
  }

  search(query: string, limit = 20): readonly WorkspaceSearchResult[] {
    const text = query.trim();
    if (text === '') return [];
    try {
      const rows = this.#database()
        .prepare(
          `SELECT file_id, path, title,
             snippet(document_fts, 3, '<mark>', '</mark>', '…', 12) AS snippet,
             bm25(document_fts) AS score
           FROM document_fts WHERE document_fts MATCH ?
           ORDER BY score LIMIT ?`,
        )
        .all(text, Math.max(1, Math.min(limit, 100))) as Array<{
        file_id: string;
        path: string;
        title: string;
        snippet: string;
        score: number;
      }>;
      return rows.map((row) => ({
        fileId: asWorkspaceFileId(row.file_id),
        path: asWorkspacePath(row.path),
        title: row.title,
        snippet: row.snippet,
        score: row.score,
      }));
    } catch {
      // Sintaxe FTS inválida é input de usuário, não falha do índice.
      return [];
    }
  }

  headings(fileId?: WorkspaceFileId): readonly IndexedHeading[] {
    const where = fileId === undefined ? '' : ' WHERE h.file_id = ?';
    const params = fileId === undefined ? [] : [String(fileId)];
    const rows = this.#database()
      .prepare(
        `SELECT h.file_id, h.node_id, f.path, h.depth, h.title, h.role, h.source_start, h.source_end
         FROM indexed_headings h JOIN indexed_files f ON f.file_id = h.file_id${where}
         ORDER BY f.path, h.source_start`,
      )
      .all(...params) as Array<Record<string, unknown>>;
    return rows.map((row) => this.#headingFromRow(row));
  }

  links(fileId?: WorkspaceFileId): readonly IndexedLink[] {
    const where = fileId === undefined ? '' : ' WHERE l.file_id = ?';
    const params = fileId === undefined ? [] : [String(fileId)];
    const rows = this.#database()
      .prepare(
        `SELECT l.file_id, l.node_id, f.path, l.target, l.kind, l.label, l.source_start, l.source_end
         FROM indexed_links l JOIN indexed_files f ON f.file_id = l.file_id${where}
         ORDER BY f.path, l.source_start`,
      )
      .all(...params) as Array<Record<string, unknown>>;
    return rows.map((row) => this.#linkFromRow(row));
  }

  citations(fileId?: WorkspaceFileId, referenceId?: string): readonly IndexedCitation[] {
    const conditions: string[] = [];
    const params: string[] = [];
    if (fileId !== undefined) {
      conditions.push('c.file_id = ?');
      params.push(String(fileId));
    }
    if (referenceId !== undefined) {
      conditions.push('c.reference_id = ?');
      params.push(referenceId);
    }
    const where = conditions.length === 0 ? '' : ` WHERE ${conditions.join(' AND ')}`;
    const rows = this.#database()
      .prepare(
        `SELECT c.file_id, c.node_id, f.path, c.reference_id, c.mode, c.locator_type, c.locator_value,
                c.source_start, c.source_end
         FROM indexed_citations c JOIN indexed_files f ON f.file_id = c.file_id${where}
         ORDER BY f.path, c.source_start`,
      )
      .all(...params) as Array<Record<string, unknown>>;
    return rows.map((row) => this.#citationFromRow(row));
  }

  resources(fileId?: WorkspaceFileId): readonly IndexedResource[] {
    const where = fileId === undefined ? '' : ' WHERE r.file_id = ?';
    const params = fileId === undefined ? [] : [String(fileId)];
    const rows = this.#database()
      .prepare(
        `SELECT r.file_id, f.path, r.resource_id, r.uri, r.media_type, r.integrity
         FROM indexed_resources r JOIN indexed_files f ON f.file_id = r.file_id${where}
         ORDER BY f.path, r.resource_id`,
      )
      .all(...params) as Array<Record<string, unknown>>;
    return rows.map((row) => this.#resourceFromRow(row));
  }

  blocks(fileId?: WorkspaceFileId, kind?: IndexedBlockKind): readonly IndexedBlock[] {
    const conditions: string[] = [];
    const params: string[] = [];
    if (fileId !== undefined) {
      conditions.push('b.file_id = ?');
      params.push(String(fileId));
    }
    if (kind !== undefined) {
      conditions.push('b.kind = ?');
      params.push(kind);
    }
    const where = conditions.length === 0 ? '' : ` WHERE ${conditions.join(' AND ')}`;
    const rows = this.#database()
      .prepare(
        `SELECT b.file_id, b.node_id, f.path, b.kind, b.source_start, b.source_end
         FROM indexed_blocks b JOIN indexed_files f ON f.file_id = b.file_id${where}
         ORDER BY f.path, b.source_start`,
      )
      .all(...params) as Array<Record<string, unknown>>;
    return rows.map((row) => this.#blockFromRow(row));
  }

  identifiers(identifier?: string): readonly IndexedIdentifier[] {
    const where = identifier === undefined ? '' : ' WHERE i.identifier = ?';
    const params = identifier === undefined ? [] : [identifier];
    const rows = this.#database()
      .prepare(
        `SELECT i.file_id, i.node_id, f.path, i.identifier, i.kind, i.label, i.source_start, i.source_end
         FROM indexed_identifiers i JOIN indexed_files f ON f.file_id = i.file_id${where}
         ORDER BY f.path, i.source_start`,
      )
      .all(...params) as Array<Record<string, unknown>>;
    return rows.map((row) => this.#identifierFromRow(row));
  }

  crossReferences(fileId?: WorkspaceFileId, identifier?: string): readonly IndexedCrossReference[] {
    const conditions: string[] = [];
    const params: string[] = [];
    if (fileId !== undefined) {
      conditions.push('x.file_id = ?');
      params.push(String(fileId));
    }
    if (identifier !== undefined) {
      conditions.push('x.identifier = ?');
      params.push(identifier);
    }
    const where = conditions.length === 0 ? '' : ` WHERE ${conditions.join(' AND ')}`;
    const rows = this.#database()
      .prepare(
        `SELECT x.file_id, x.node_id, f.path, x.identifier, x.source_start, x.source_end
         FROM indexed_xrefs x JOIN indexed_files f ON f.file_id = x.file_id${where}
         ORDER BY f.path, x.source_start`,
      )
      .all(...params) as Array<Record<string, unknown>>;
    return rows.map((row) => this.#crossReferenceFromRow(row));
  }

  documentTitles(): readonly IndexedDocumentTitle[] {
    const rows = this.#database()
      .prepare('SELECT file_id, path, title FROM document_fts ORDER BY path')
      .all() as Array<{ file_id: string; path: string; title: string }>;
    return rows.map((row) => ({
      fileId: asWorkspaceFileId(row.file_id),
      path: asWorkspacePath(row.path),
      title: row.title,
    }));
  }

  async #openDatabase(): Promise<void> {
    await mkdir(dirname(this.#databasePath), { recursive: true });
    this.#connection = new Database(this.#databasePath);
    migrateWorkspaceIndex(this.#connection);
  }

  #database(): SqliteDatabase {
    if (this.#connection === undefined) throw new Error('Índice SQLite não está aberto.');
    return this.#connection;
  }

  #requireOpen(): void {
    if (!this.#opened) throw new Error('WorkspaceIndex não está aberto.');
  }

  #enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = this.#tail.then(task);
    this.#tail = next.then(
      () => undefined,
      (error: unknown) => {
        this.#lastError = error;
      },
    );
    return next;
  }

  async #applyWorkspaceEvent(event: WorkspaceEvent): Promise<void> {
    switch (event.type) {
      case 'workspace:file-created':
      case 'workspace:file-changed':
      case 'workspace:file-renamed':
        await this.#indexFile(event.file);
        break;
      case 'workspace:file-removed':
        this.#deleteFile(event.fileId);
        break;
      case 'workspace:recovery-conflict':
        break;
    }
  }

  #matchesFingerprint(row: IndexedFileRow, file: WorkspaceFile): boolean {
    const fingerprint = this.#fingerprintFor(file);
    return (
      row.path === file.path &&
      row.revision === fingerprint.revision &&
      row.content_hash === fingerprint.contentHash &&
      row.document_id === (file.documentId ?? null) &&
      row.media_type === (file.mediaType ?? null) &&
      row.is_markdown === (isMarkdownPath(file.path) ? 1 : 0)
    );
  }

  #fingerprintFor(file: WorkspaceFile): IndexFingerprint {
    return { revision: file.revision, contentHash: String(file.contentHash) };
  }

  async #indexFile(file: WorkspaceFile): Promise<void> {
    let content;
    try {
      content = await this.#storage.read(file.id);
    } catch (error) {
      // Eventos podem chegar depois de uma remoção externa. O filesystem ainda
      // é autoridade: a projeção derivada apenas remove o registro obsoleto.
      if (error instanceof WorkspaceFileNotFoundError) {
        this.#deleteFile(file.id);
        return;
      }
      throw error;
    }
    const current = content.file;
    const markdown = isMarkdownPath(current.path);
    const ast = markdown
      ? parseMarkdownComDiagnosticos(content.content, {
          documentId: String(current.documentId ?? current.id),
        }).ast
      : undefined;
    this.#replaceFile(current, content.content, ast);
  }

  #replaceFile(file: WorkspaceFile, content: string, ast: DocumentAst | undefined): void {
    const database = this.#database();
    database.transaction(() => {
      this.#deleteFile(String(file.id));
      // Um path só pertence a um file_id por vez. Se o storage reatribuiu o id
      // deste path (registro reconstruído após perda de estado), a linha antiga
      // sob o id anterior fica órfã aqui e colidiria com o UNIQUE de path.
      this.#deletePath(String(file.path));
      database
        .prepare(
          `INSERT INTO indexed_files
           (file_id, document_id, path, revision, content_hash, media_type, is_markdown, indexed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          String(file.id),
          file.documentId === undefined ? null : String(file.documentId),
          String(file.path),
          file.revision,
          String(file.contentHash),
          file.mediaType ?? null,
          ast === undefined ? 0 : 1,
          Date.now(),
        );
      if (ast === undefined) return;

      const title = textOf(ast.document.metadata.title) || String(file.path);
      database
        .prepare('INSERT INTO document_fts (file_id, path, title, content) VALUES (?, ?, ?, ?)')
        .run(String(file.id), String(file.path), title, content);
      this.#insertStructure(file, ast);
    })();
  }

  #insertStructure(file: WorkspaceFile, ast: DocumentAst): void {
    const database = this.#database();
    const heading = database.prepare(
      `INSERT INTO indexed_headings
       (file_id, node_id, depth, title, role, source_start, source_end) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const link = database.prepare(
      `INSERT INTO indexed_links
       (file_id, node_id, target, kind, label, source_start, source_end) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const citation = database.prepare(
      `INSERT INTO indexed_citations
       (file_id, node_id, reference_id, mode, locator_type, locator_value, source_start, source_end)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const resource = database.prepare(
      `INSERT INTO indexed_resources (file_id, resource_id, uri, media_type, integrity) VALUES (?, ?, ?, ?, ?)`,
    );
    const block = database.prepare(
      `INSERT INTO indexed_blocks (file_id, node_id, kind, source_start, source_end) VALUES (?, ?, ?, ?, ?)`,
    );
    const identifier = database.prepare(
      `INSERT INTO indexed_identifiers (file_id, node_id, identifier, kind, label, source_start, source_end)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const xref = database.prepare(
      `INSERT INTO indexed_xrefs (file_id, node_id, identifier, source_start, source_end) VALUES (?, ?, ?, ?, ?)`,
    );

    for (const node of percorrer(ast)) {
      if (node.type === 'cross-reference' && node.target.kind === 'identifier') {
        const offsets = sourceOffsets(node.source);
        xref.run(String(file.id), String(node.id), node.target.identifier, offsets.start, offsets.end);
      }
      if (node.type === 'figure' || node.type === 'table') {
        const offsets = sourceOffsets(node.source);
        block.run(String(file.id), String(node.id), node.type, offsets.start, offsets.end);
      }
      // F68: mesma origem de identificador que `crossReferenceTargets` já
      // computa por documento em @abnt/language-service — aqui vira uma
      // projeção vault-wide, para `[[ref:id]]` resolver mesmo quando a
      // declaração vive num outro módulo (transclusão, F60).
      if (node.attributes?.identifier !== undefined) {
        const id = node.attributes.identifier;
        const offsets = sourceOffsets(node.source);
        const kindAndLabel: { kind: IndexedIdentifierKind; label: string } | undefined =
          node.type === 'section' ? { kind: 'section', label: textOf(node.title) || id }
          : node.type === 'figure' ? { kind: 'figure', label: textOf(node.caption?.short) || id }
          : node.type === 'table' ? { kind: 'table', label: id }
          : node.type === 'math-block' ? { kind: 'equation', label: id }
          : undefined;
        if (kindAndLabel !== undefined) {
          identifier.run(String(file.id), String(node.id), id, kindAndLabel.kind, kindAndLabel.label, offsets.start, offsets.end);
        }
      }
      if (node.type === 'section' || node.type === 'heading') {
        const title = node.type === 'section' ? textOf(node.title) : textOf(node.children);
        const offsets = sourceOffsets(node.source);
        heading.run(
          String(file.id),
          String(node.id),
          node.depth,
          title,
          node.type === 'section' ? (node.role ?? null) : null,
          offsets.start,
          offsets.end,
        );
      }
      if (node.type === 'link') {
        const offsets = sourceOffsets(node.source);
        link.run(
          String(file.id),
          String(node.id),
          node.url,
          linkKindFor(node.url),
          textOf(node.children),
          offsets.start,
          offsets.end,
        );
      }
      if (node.type === 'citation') {
        const offsets = sourceOffsets(node.source);
        for (const item of node.items) {
          citation.run(
            String(file.id),
            String(node.id),
            String(item.referenceId),
            node.mode,
            item.locator?.type ?? null,
            item.locator?.value ?? null,
            offsets.start,
            offsets.end,
          );
        }
      }
    }

    for (const entry of Object.values(ast.resources)) {
      resource.run(
        String(file.id),
        String(entry.id),
        entry.uri,
        entry.mediaType ?? null,
        entry.integrity === undefined ? null : `${entry.integrity.algorithm}:${entry.integrity.value}`,
      );
    }
  }

  #deleteFile(fileId: WorkspaceFileId | string): void {
    const database = this.#database();
    const id = String(fileId);
    database.prepare('DELETE FROM document_fts WHERE file_id = ?').run(id);
    database.prepare('DELETE FROM indexed_files WHERE file_id = ?').run(id);
  }

  #deletePath(path: string): void {
    const database = this.#database();
    database.prepare('DELETE FROM document_fts WHERE path = ?').run(path);
    database.prepare('DELETE FROM indexed_files WHERE path = ?').run(path);
  }

  #headingFromRow(row: Record<string, unknown>): IndexedHeading {
    return {
      fileId: asWorkspaceFileId(String(row.file_id)),
      nodeId: String(row.node_id),
      path: asWorkspacePath(String(row.path)),
      depth: Number(row.depth),
      title: String(row.title),
      ...(typeof row.role === 'string' ? { role: row.role } : {}),
      ...(typeof row.source_start === 'number' ? { sourceStart: row.source_start } : {}),
      ...(typeof row.source_end === 'number' ? { sourceEnd: row.source_end } : {}),
    };
  }

  #linkFromRow(row: Record<string, unknown>): IndexedLink {
    return {
      fileId: asWorkspaceFileId(String(row.file_id)),
      nodeId: String(row.node_id),
      path: asWorkspacePath(String(row.path)),
      target: String(row.target),
      kind: String(row.kind) as IndexedLinkKind,
      label: String(row.label),
      ...(typeof row.source_start === 'number' ? { sourceStart: row.source_start } : {}),
      ...(typeof row.source_end === 'number' ? { sourceEnd: row.source_end } : {}),
    };
  }

  #citationFromRow(row: Record<string, unknown>): IndexedCitation {
    return {
      fileId: asWorkspaceFileId(String(row.file_id)),
      nodeId: String(row.node_id),
      path: asWorkspacePath(String(row.path)),
      referenceId: String(row.reference_id),
      mode: String(row.mode),
      ...(typeof row.locator_type === 'string' ? { locatorType: row.locator_type } : {}),
      ...(typeof row.locator_value === 'string' ? { locatorValue: row.locator_value } : {}),
      ...(typeof row.source_start === 'number' ? { sourceStart: row.source_start } : {}),
      ...(typeof row.source_end === 'number' ? { sourceEnd: row.source_end } : {}),
    };
  }

  #resourceFromRow(row: Record<string, unknown>): IndexedResource {
    return {
      fileId: asWorkspaceFileId(String(row.file_id)),
      path: asWorkspacePath(String(row.path)),
      resourceId: String(row.resource_id),
      uri: String(row.uri),
      ...(typeof row.media_type === 'string' ? { mediaType: row.media_type } : {}),
      ...(typeof row.integrity === 'string' ? { integrity: row.integrity } : {}),
    };
  }

  #blockFromRow(row: Record<string, unknown>): IndexedBlock {
    return {
      fileId: asWorkspaceFileId(String(row.file_id)),
      nodeId: String(row.node_id),
      path: asWorkspacePath(String(row.path)),
      kind: String(row.kind) as IndexedBlockKind,
      ...(typeof row.source_start === 'number' ? { sourceStart: row.source_start } : {}),
      ...(typeof row.source_end === 'number' ? { sourceEnd: row.source_end } : {}),
    };
  }

  #identifierFromRow(row: Record<string, unknown>): IndexedIdentifier {
    return {
      fileId: asWorkspaceFileId(String(row.file_id)),
      nodeId: String(row.node_id),
      path: asWorkspacePath(String(row.path)),
      identifier: String(row.identifier),
      kind: String(row.kind) as IndexedIdentifierKind,
      label: String(row.label),
      ...(typeof row.source_start === 'number' ? { sourceStart: row.source_start } : {}),
      ...(typeof row.source_end === 'number' ? { sourceEnd: row.source_end } : {}),
    };
  }

  #crossReferenceFromRow(row: Record<string, unknown>): IndexedCrossReference {
    return {
      fileId: asWorkspaceFileId(String(row.file_id)),
      nodeId: String(row.node_id),
      path: asWorkspacePath(String(row.path)),
      identifier: String(row.identifier),
      ...(typeof row.source_start === 'number' ? { sourceStart: row.source_start } : {}),
      ...(typeof row.source_end === 'number' ? { sourceEnd: row.source_end } : {}),
    };
  }
}
