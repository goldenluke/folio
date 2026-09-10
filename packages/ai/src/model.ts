/** Provider-agnostic contract. Implementations never receive a vault path. */
export type AiCapability = 'complete' | 'embed';
export type AiContextKind = 'selection' | 'document' | 'section' | 'reference' | 'literature-note' | 'pdf-annotation' | 'project';

export interface AiContextItem {
  readonly id: string;
  readonly kind: AiContextKind;
  readonly label: string;
  readonly text: string;
  readonly source?: { readonly fileId?: string; readonly path?: string; readonly url?: string };
}

export interface AiContext {
  readonly items: readonly AiContextItem[];
}

export interface AiCompletionRequest {
  readonly instruction: string;
  readonly context: AiContext;
  readonly temperature?: number;
}

export interface AiCompletion {
  readonly text: string;
  readonly provider: string;
  readonly model?: string;
}

export interface AiEmbeddingRequest { readonly texts: readonly string[]; }
export interface AiProvider {
  readonly id: string;
  readonly label: string;
  capabilities(): readonly AiCapability[];
  complete(request: AiCompletionRequest, signal?: AbortSignal): Promise<AiCompletion>;
  embed?(request: AiEmbeddingRequest, signal?: AbortSignal): Promise<readonly (readonly number[])[]>;
}

export interface AiDisclosure {
  readonly provider: string;
  readonly external: boolean;
  readonly items: readonly { readonly kind: AiContextKind; readonly label: string; readonly characters: number }[];
  readonly totalCharacters: number;
}

export interface AiSourceSuggestion { readonly sourceId: string; readonly score: number; readonly reason: string; }
export interface AiActionPreview { readonly before: string; readonly after: string; readonly inserted: string; readonly removed: string; }
