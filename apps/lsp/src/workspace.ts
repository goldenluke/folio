import { createHash } from 'node:crypto';
import { join } from 'node:path';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { WorkspaceLanguageService, type LanguageService } from '@abnt/language-service';
import { createInProcessCompilerClient } from '@abnt/protocol';
import type { WorkspaceStorage } from '@abnt/workspace-core';
import { criarResolvedorDeAmbienteLocal } from '@abnt/workspace-environment';
import { SqliteWorkspaceIndex, type WorkspaceIndex } from '@abnt/workspace-index';
import { LocalFilesystemStorage } from '@abnt/workspace-local';
import { DocumentSessionsService, type DocumentSessions } from '@abnt/workspace-sessions';

export interface LspWorkspace {
  readonly rootPath: string;
  readonly storage: WorkspaceStorage;
  readonly index: WorkspaceIndex;
  readonly sessions: DocumentSessions;
  readonly language: LanguageService;
  dispose(): Promise<void>;
}

/**
 * Mesma composição do Workspace Service do desktop (storage + índice +
 * sessões + language service), mas num único processo Node — o LSP não tem
 * o motivo de isolamento de crash que justifica utility processes no
 * Electron (ver ADR 0014). Compilador roda in-process, sem MessagePort.
 *
 * Índice em `.academic/index-lsp.sqlite`, deliberadamente separado do
 * `.academic/index.sqlite` do desktop: os dois são projeções descartáveis do
 * mesmo vault, mas SQLite não garante segurança sob dois processos
 * escrevendo concorrentemente no mesmo arquivo. Ver ADR 0018.
 */
export async function openWorkspace(rootPath: string): Promise<LspWorkspace> {
  const storage = LocalFilesystemStorage.create(rootPath);
  await storage.open();

  const index = SqliteWorkspaceIndex.create({
    storage,
    databasePath: join(rootPath, '.academic', 'index-lsp.sqlite'),
  });
  await index.open();

  const sessions = DocumentSessionsService.create({
    storage,
    compiler: createInProcessCompilerClient(criarServicoDeCompiler()),
    environment: criarResolvedorDeAmbienteLocal(storage),
    hashContent: (content) => `sha256:${createHash('sha256').update(content).digest('hex')}`,
    autoCompile: true,
  });

  const language = WorkspaceLanguageService.create({ storage, index, sessions });

  return {
    rootPath,
    storage,
    index,
    sessions,
    language,
    async dispose() {
      await sessions.dispose();
      await index.close();
      await storage.close();
    },
  };
}
