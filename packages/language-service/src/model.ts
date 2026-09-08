import type { SourceRange } from '@abnt/document-model';
import type { WorkspaceFileId, WorkspacePath, WorkspaceStorage } from '@abnt/workspace-core';
import type { WorkspaceIndex } from '@abnt/workspace-index';
import type { DocumentSessions } from '@abnt/workspace-sessions';

/** Offset UTF-16 no texto do editor, igual ao usado por CodeMirror e SourceRange. */
export interface LanguagePosition {
  readonly fileId: WorkspaceFileId;
  readonly offset: number;
}

export interface LanguageRange {
  readonly start: number;
  readonly end: number;
}

export interface LanguageLocation {
  readonly fileId: WorkspaceFileId;
  readonly path: WorkspacePath;
  readonly range: LanguageRange;
}

/** Um link indexado de outro documento que resolve para o arquivo consultado. */
export interface LanguageBacklink {
  readonly fileId: WorkspaceFileId;
  readonly path: WorkspacePath;
  /** Texto clicável do link na origem — o que dá contexto ao backlink. */
  readonly label: string;
  readonly range: LanguageRange;
}

export interface LanguageOutlineItem {
  readonly nodeId: string;
  readonly title: string;
  readonly depth: number;
  readonly role?: string;
  readonly range: LanguageRange;
}

/** Alvo autoral persistido para inserção de referência cruzada. */
export interface LanguageCrossReferenceTarget {
  readonly identifier: string;
  readonly kind: 'section' | 'figure' | 'table' | 'equation';
  readonly label: string;
  readonly range: LanguageRange;
}

/**
 * Título de outro documento mencionado em texto puro, sem link — sugestão
 * opt-in (F32/"Backlinks 2.0"), nunca uma edição automática. `text` preserva a
 * grafia exata encontrada no documento (pode diferir do título em maiúsculas).
 */
export type LanguageUnlinkedMention =
  | {
    readonly kind: 'document';
    readonly range: LanguageRange;
    readonly targetFileId: WorkspaceFileId;
    readonly targetPath: WorkspacePath;
    readonly text: string;
  }
  | {
    /** F74: título/autoria bibliográfica sugere uma citação, não um link de arquivo. */
    readonly kind: 'reference';
    readonly range: LanguageRange;
    readonly referenceId: string;
    readonly text: string;
  };

/** @deprecated Use o discriminante `kind` de LanguageUnlinkedMention. */
export interface LegacyLanguageUnlinkedMention {
  readonly range: LanguageRange;
  readonly targetFileId: WorkspaceFileId;
  readonly targetPath: WorkspacePath;
  readonly text: string;
}

/** Projeção de escrita para o documento ativo; frontmatter não integra o AST. */
export interface LanguageWritingSection {
  readonly title: string;
  readonly words: number;
}

export interface LanguageWritingStatistics {
  readonly words: number;
  readonly characters: number;
  readonly paragraphs: number;
  readonly citations: number;
  readonly figures: number;
  readonly tables: number;
  readonly equations: number;
  readonly estimatedReadingMinutes: number;
  /** Seções Markdown contadas no serviço, para metas locais de capítulo/resumo. */
  readonly sections: readonly LanguageWritingSection[];
}

/** Edição textual revisionada, calculada pelo serviço sem dar ao renderer acesso ao vault. */
export interface LanguageWorkspaceEdit {
  readonly label: string;
  readonly changes: readonly {
    readonly fileId: WorkspaceFileId;
    readonly path: WorkspacePath;
    readonly expectedRevision: number;
    readonly edits: readonly { readonly range: LanguageRange; readonly text: string }[];
  }[];
}

export type LanguageCompletionKind = 'citation' | 'document' | 'math';

export interface LanguageCompletionItem {
  readonly kind: LanguageCompletionKind;
  readonly label: string;
  readonly detail?: string;
  /** Apenas o trecho que substitui `range`; o editor conserva delimitadores. */
  readonly insertText: string;
}

export interface LanguageCompletionResult {
  readonly range: LanguageRange;
  readonly items: readonly LanguageCompletionItem[];
}

export interface LanguageHover {
  readonly range: LanguageRange;
  readonly contents: readonly string[];
}

export interface LanguageDiagnostic {
  readonly id: string;
  readonly severity: 'info' | 'warning' | 'error';
  readonly message: string;
  readonly source?: SourceRange;
}

/** Entrada bibliográfica que pode vir de .bib, Zotero, DOI ou memória. */
export interface LanguageReference {
  readonly id: string;
  readonly title?: string;
  readonly authors?: readonly string[];
  readonly issued?: string;
  /** Quando a origem suporta localização (p.ex. .bib), habilita go-to-definition. */
  readonly definition?: LanguageLocation;
}

/** Porta de referências: o language service não escolhe de onde a bibliografia vem. */
export interface LanguageReferenceCatalog {
  search(query: string, limit: number): Promise<readonly LanguageReference[]>;
  find(referenceId: string): Promise<LanguageReference | undefined>;
  /** Catálogos que conseguem enumerar entradas habilitam F74 sem I/O no renderer. */
  all?(): Promise<readonly LanguageReference[]>;
}

/**
 * Um documento pode declarar sua própria fonte bibliográfica. O host escolhe
 * o catálogo efetivo; o language service continua independente de `.bib`,
 * SQLite e qualquer UI.
 */
export type LanguageReferenceCatalogResolver = (
  fileId: WorkspaceFileId,
) => Promise<LanguageReferenceCatalog | undefined>;

export interface LanguageServiceOptions {
  readonly storage: WorkspaceStorage;
  readonly index: WorkspaceIndex;
  readonly sessions: DocumentSessions;
  readonly references?: LanguageReferenceCatalog;
  readonly referencesFor?: LanguageReferenceCatalogResolver;
}

export interface LanguageService {
  outline(fileId: WorkspaceFileId): Promise<readonly LanguageOutlineItem[]>;
  diagnostics(fileId: WorkspaceFileId): Promise<readonly LanguageDiagnostic[]>;
  completions(position: LanguagePosition, limit?: number): Promise<LanguageCompletionResult | undefined>;
  hover(position: LanguagePosition): Promise<LanguageHover | undefined>;
  definition(position: LanguagePosition): Promise<readonly LanguageLocation[]>;
  references(position: LanguagePosition): Promise<readonly LanguageLocation[]>;
  crossReferenceTargets(fileId: WorkspaceFileId): Promise<readonly LanguageCrossReferenceTarget[]>;
  /** Links de outros documentos que resolvem para `fileId` — projeção do índice, não parse local. */
  backlinks(fileId: WorkspaceFileId): Promise<readonly LanguageBacklink[]>;
  /** Menções textuais a títulos de outros documentos, fora de link/citação existente. */
  unlinkedMentions(fileId: WorkspaceFileId): Promise<readonly LanguageUnlinkedMention[]>;
  writingStatistics(fileId: WorkspaceFileId): Promise<LanguageWritingStatistics>;
  rename(position: LanguagePosition, newName: string): Promise<LanguageWorkspaceEdit | undefined>;
  moveSection(position: LanguagePosition, direction: 'up' | 'down'): Promise<LanguageWorkspaceEdit | undefined>;
}
