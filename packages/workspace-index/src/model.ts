import type { WorkspaceFileId, WorkspacePath, WorkspaceStorage } from '@abnt/workspace-core';

/** Versão independente do schema descartável do índice SQLite. */
export const WORKSPACE_INDEX_SCHEMA_VERSION = 3;

export interface WorkspaceIndexOptions {
  readonly storage: WorkspaceStorage;
  /** Normalmente `<vault>/.academic/index.sqlite`; nunca contém autoria. */
  readonly databasePath: string;
}

/** Fingerprint persistido para decidir se um arquivo exige nova análise. */
export interface IndexFingerprint {
  readonly revision: number;
  readonly contentHash: string;
}

export interface IndexSynchronizationResult {
  readonly indexed: number;
  readonly skipped: number;
  readonly removed: number;
}

export interface WorkspaceIndexStats {
  readonly schemaVersion: number;
  readonly files: number;
  readonly markdownFiles: number;
  readonly headings: number;
  readonly links: number;
  readonly citations: number;
  readonly resources: number;
  readonly blocks: number;
  readonly identifiers: number;
  readonly crossReferences: number;
}

export interface IndexedHeading {
  readonly fileId: WorkspaceFileId;
  readonly nodeId: string;
  readonly path: WorkspacePath;
  readonly depth: number;
  readonly title: string;
  readonly role?: string;
  readonly sourceStart?: number;
  readonly sourceEnd?: number;
}

export type IndexedLinkKind = 'external' | 'anchor' | 'document';

export interface IndexedLink {
  readonly fileId: WorkspaceFileId;
  readonly nodeId: string;
  readonly path: WorkspacePath;
  readonly target: string;
  readonly kind: IndexedLinkKind;
  readonly label: string;
  readonly sourceStart?: number;
  readonly sourceEnd?: number;
}

export interface IndexedCitation {
  readonly fileId: WorkspaceFileId;
  readonly nodeId: string;
  readonly path: WorkspacePath;
  readonly referenceId: string;
  readonly mode: string;
  readonly locatorType?: string;
  readonly locatorValue?: string;
  readonly sourceStart?: number;
  readonly sourceEnd?: number;
}

export type IndexedBlockKind = 'figure' | 'table';

export interface IndexedBlock {
  readonly fileId: WorkspaceFileId;
  readonly nodeId: string;
  readonly path: WorkspacePath;
  readonly kind: IndexedBlockKind;
  readonly sourceStart?: number;
  readonly sourceEnd?: number;
}

/**
 * F68 — identidade de um `{#id}` declarado em qualquer arquivo do vault.
 * Mesma forma de `LanguageCrossReferenceTarget` (`@abnt/language-service`),
 * do outro lado da fronteira índice/language-service: seção, figura, tabela e
 * equação são as únicas origens de identificador hoje. Existe para que
 * `[[ref:id]]` resolvido num módulo aponte para o arquivo real que declarou o
 * identificador, mesmo quando os dois só se encontram via transclusão (F60).
 */
export type IndexedIdentifierKind = 'section' | 'figure' | 'table' | 'equation';

export interface IndexedIdentifier {
  readonly fileId: WorkspaceFileId;
  readonly nodeId: string;
  readonly path: WorkspacePath;
  readonly identifier: string;
  readonly kind: IndexedIdentifierKind;
  readonly label: string;
  readonly sourceStart?: number;
  readonly sourceEnd?: number;
}

/** F68 — ocorrência de `[[ref:id]]` (não a declaração); sustenta `references()` cross-file. */
export interface IndexedCrossReference {
  readonly fileId: WorkspaceFileId;
  readonly nodeId: string;
  readonly path: WorkspacePath;
  readonly identifier: string;
  readonly sourceStart?: number;
  readonly sourceEnd?: number;
}

export interface IndexedDocumentTitle {
  readonly fileId: WorkspaceFileId;
  readonly path: WorkspacePath;
  readonly title: string;
}

export interface IndexedResource {
  readonly fileId: WorkspaceFileId;
  readonly path: WorkspacePath;
  readonly resourceId: string;
  readonly uri: string;
  readonly mediaType?: string;
  readonly integrity?: string;
}

export interface WorkspaceSearchResult {
  readonly fileId: WorkspaceFileId;
  readonly path: WorkspacePath;
  readonly title: string;
  readonly snippet: string;
  readonly score: number;
}

/**
 * Projeção derivada do vault. Excluir seu arquivo SQLite nunca perde Markdown,
 * referências ou assets: `rebuild()` o recompõe a partir de WorkspaceStorage.
 */
export interface WorkspaceIndex {
  open(): Promise<IndexSynchronizationResult>;
  close(): Promise<void>;
  synchronize(): Promise<IndexSynchronizationResult>;
  rebuild(): Promise<IndexSynchronizationResult>;
  idle(): Promise<void>;
  stats(): WorkspaceIndexStats;
  search(query: string, limit?: number): readonly WorkspaceSearchResult[];
  headings(fileId?: WorkspaceFileId): readonly IndexedHeading[];
  links(fileId?: WorkspaceFileId): readonly IndexedLink[];
  citations(fileId?: WorkspaceFileId, referenceId?: string): readonly IndexedCitation[];
  resources(fileId?: WorkspaceFileId): readonly IndexedResource[];
  blocks(fileId?: WorkspaceFileId, kind?: IndexedBlockKind): readonly IndexedBlock[];
  /** F68 — busca vault-wide; sem `identifier`, devolve todos (para picker/diagnóstico). */
  identifiers(identifier?: string): readonly IndexedIdentifier[];
  /** F68 — ocorrências de `[[ref:id]]`, para `references()` cross-file. */
  crossReferences(fileId?: WorkspaceFileId, identifier?: string): readonly IndexedCrossReference[];
  /** Títulos de todo o vault, para detecção de menções não linkadas (F32). */
  documentTitles(): readonly IndexedDocumentTitle[];
}
