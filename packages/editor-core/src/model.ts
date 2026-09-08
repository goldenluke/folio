import type {
  LanguageDiagnostic,
  LanguageOutlineItem,
  LanguageService,
} from '@abnt/language-service';
import type { WorkspaceFileId } from '@abnt/workspace-core';
import type { DocumentSessionPreview, DocumentSessionSnapshot, DocumentSessions, ExternalConflictResolution } from '@abnt/workspace-sessions';

/** Seleção UTF-16 independente de qualquer implementação de editor visual. */
export interface EditorSelection {
  readonly anchor: number;
  readonly head: number;
}

export interface EditorTextEdit {
  readonly range: {
    readonly start: number;
    readonly end: number;
  };
  readonly text: string;
}

/** Transação atômica, sempre relativa ao snapshot atual do controller. */
export interface EditorTransaction {
  readonly edits?: readonly EditorTextEdit[];
  readonly selection?: EditorSelection;
}

export interface EditorSnapshot {
  readonly fileId: WorkspaceFileId;
  readonly version: number;
  readonly session: DocumentSessionSnapshot;
  readonly selection: EditorSelection;
  readonly outline: readonly LanguageOutlineItem[];
  readonly diagnostics: readonly LanguageDiagnostic[];
  readonly preview?: DocumentSessionPreview;
  readonly bibliography?: DocumentSessionSnapshot['bibliography'];
  readonly externalChange?: DocumentSessionSnapshot['externalChange'];
}

export type EditorEvent =
  | { readonly type: 'editor:changed'; readonly snapshot: EditorSnapshot }
  | { readonly type: 'editor:projections-updated'; readonly snapshot: EditorSnapshot }
  | { readonly type: 'editor:closed'; readonly fileId: WorkspaceFileId };

export type EditorEventListener = (event: EditorEvent) => void;

export interface EditorController {
  readonly fileId: WorkspaceFileId;
  snapshot(): EditorSnapshot;
  dispatch(transaction: EditorTransaction): EditorSnapshot;
  save(): Promise<EditorSnapshot>;
  resolveExternalConflict(resolution: ExternalConflictResolution): Promise<EditorSnapshot>;
  idle(): Promise<void>;
  subscribe(listener: EditorEventListener): () => void;
  dispose(): void;
}

export interface EditorWorkspaceOptions {
  readonly sessions: DocumentSessions;
  readonly language: LanguageService;
}

/** Dono de controllers abertos; sessão continua sendo a autoridade do texto. */
export interface EditorWorkspace {
  open(fileId: WorkspaceFileId): Promise<EditorController>;
  controller(fileId: WorkspaceFileId): EditorController | undefined;
  close(fileId: WorkspaceFileId): void;
  dispose(): void;
}
