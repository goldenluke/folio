import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createLspServer } from '../apps/lsp/src/create-server.js';
import { pathFromUri, uriFromPath } from '../apps/lsp/src/uri.js';
import { asWorkspacePath } from '@abnt/workspace-core';

const A = '# Introdução\n\nVeja também [o arquivo B](b.md) para mais contexto.\n\n## Contexto\n';
const B = '# Arquivo B\n\nConteúdo de apoio.\n';

const withVault = async (run: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'abnt-p13-'));
  try {
    await writeFile(join(root, 'a.md'), A, 'utf8');
    await writeFile(join(root, 'b.md'), B, 'utf8');
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

/**
 * Cliente LSP mínimo sobre um par de streams em memória (sem subprocesso):
 * fala o framing real (`Content-Length`) contra o `Connection` de
 * `createLspServer`, o mesmo protocolo que um editor real usaria por stdio.
 */
class LspTestClient {
  #output: PassThrough;
  #buffer = Buffer.alloc(0);
  #pending = new Map<number, (message: { result?: unknown; error?: unknown }) => void>();
  #nextId = 1;

  constructor(input: PassThrough, output: PassThrough) {
    this.#output = input;
    output.on('data', (chunk: Buffer) => this.#onData(chunk));
  }

  #onData(chunk: Buffer): void {
    this.#buffer = Buffer.concat([this.#buffer, chunk]);
    for (;;) {
      const headerEnd = this.#buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) return;
      const header = this.#buffer.subarray(0, headerEnd).toString('utf8');
      const match = /Content-Length: (\d+)/iu.exec(header);
      if (match?.[1] === undefined) throw new Error(`cabeçalho sem Content-Length: ${header}`);
      const length = Number(match[1]);
      const bodyStart = headerEnd + 4;
      if (this.#buffer.length < bodyStart + length) return;
      const body = this.#buffer.subarray(bodyStart, bodyStart + length).toString('utf8');
      this.#buffer = this.#buffer.subarray(bodyStart + length);
      const message = JSON.parse(body) as { id?: number; result?: unknown; error?: unknown };
      if (typeof message.id === 'number') this.#pending.get(message.id)?.(message);
    }
  }

  #write(payload: Record<string, unknown>): void {
    const json = JSON.stringify(payload);
    this.#output.write(`Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`, 'utf8');
  }

  notify(method: string, params: unknown): void {
    this.#write({ jsonrpc: '2.0', method, params });
  }

  request<T>(method: string, params: unknown): Promise<T> {
    const id = this.#nextId++;
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`timeout esperando resposta de ${method}`)), 10_000);
      this.#pending.set(id, (message) => {
        clearTimeout(timeout);
        if (message.error !== undefined) reject(new Error(`${method} -> ${JSON.stringify(message.error)}`));
        else resolve(message.result as T);
      });
      this.#write({ jsonrpc: '2.0', id, method, params });
    });
  }
}

interface LspLocation {
  uri: string;
  range: { start: { line: number; character: number }; end: { line: number; character: number } };
}
interface LspSymbol {
  name: string;
}
interface LspCompletionItem {
  label: string;
}

describe('P13 — servidor LSP como adapter sobre language-service', () => {
  it('fala o protocolo real: initialize, outline, definição, hover, referências e completions', async () => {
    await withVault(async (root) => {
      const clientToServer = new PassThrough();
      const serverToClient = new PassThrough();
      const connection = createLspServer(clientToServer, serverToClient);
      const client = new LspTestClient(clientToServer, serverToClient);

      try {
        const rootUri = pathToFileURL(root).toString();
        const init = await client.request<{ capabilities: Record<string, unknown> }>('initialize', {
          processId: process.pid,
          rootUri,
          workspaceFolders: [{ uri: rootUri, name: 'vault' }],
          capabilities: {},
        });
        expect(init.capabilities.documentSymbolProvider).toBe(true);
        expect(init.capabilities.definitionProvider).toBe(true);
        client.notify('initialized', {});

        const aUri = pathToFileURL(join(root, 'a.md')).toString();
        client.notify('textDocument/didOpen', {
          textDocument: { uri: aUri, languageId: 'markdown', version: 1, text: A },
        });
        await new Promise((resolve) => setTimeout(resolve, 400)); // sessão compila em background

        const symbols = await client.request<LspSymbol[]>('textDocument/documentSymbol', {
          textDocument: { uri: aUri },
        });
        expect(symbols.map((symbol) => symbol.name)).toEqual(['Introdução', 'Contexto']);

        const linkPosition = { line: 2, character: 27 }; // dentro de "b.md" em "[o arquivo B](b.md)"
        const definition = await client.request<LspLocation[]>('textDocument/definition', {
          textDocument: { uri: aUri },
          position: linkPosition,
        });
        expect(definition).toHaveLength(1);
        expect(definition[0]?.uri).toBe(pathToFileURL(join(root, 'b.md')).toString());

        const hover = await client.request<{ contents: { value: string } }>('textDocument/hover', {
          textDocument: { uri: aUri },
          position: linkPosition,
        });
        expect(hover.contents.value).toContain('b.md');

        const references = await client.request<LspLocation[]>('textDocument/references', {
          textDocument: { uri: aUri },
          position: linkPosition,
          context: { includeDeclaration: true },
        });
        expect(references.length).toBeGreaterThanOrEqual(1);

        const completion = await client.request<LspCompletionItem[]>('textDocument/completion', {
          textDocument: { uri: aUri },
          position: { line: 2, character: 26 }, // logo após "(" no link
        });
        expect(completion.map((item) => item.label)).toContain('b.md');

        client.notify('textDocument/didClose', { textDocument: { uri: aUri } });
        await client.request('shutdown', null);
        client.notify('exit', null);
      } finally {
        connection.dispose();
      }
    });
  });
});

describe('P13 — conversão de URI <-> caminho do vault', () => {
  it('faz o percurso de ida e volta entre caminho e file:// URI', () => {
    const uri = uriFromPath('/vault', asWorkspacePath('sub/artigo.md'));
    expect(uri).toBe('file:///vault/sub/artigo.md');
    expect(pathFromUri('/vault', uri)).toBe('sub/artigo.md');
  });

  it('não duplica a barra quando rootPath já termina em "/"', () => {
    // Regressão: uriFromPath concatenava rootPath + '/' + path sem checar se
    // rootPath já tinha barra final (ex.: alguns clientes mandam rootUri com
    // barra), produzindo "file:///vault//b.md" e quebrando a resolução do
    // arquivo alvo em definition/references.
    const uri = uriFromPath('/vault/', asWorkspacePath('b.md'));
    expect(uri).toBe('file:///vault/b.md');
  });

  it('rejeita um alvo fora do vault', () => {
    expect(pathFromUri('/vault', 'file:///outro/lugar/artigo.md')).toBeUndefined();
  });
});
