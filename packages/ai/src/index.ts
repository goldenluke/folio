export { buildAiContext, contextAsPrompt, disclosureFor } from './context.js';
export { createLocalAiProvider } from './local-provider.js';
export { academicInstruction, actionPreview, claimToSource, citedContext, hybridSearch, semanticSearch } from './workflows.js';
export type { AiActionPreview, AiCapability, AiCompletion, AiCompletionRequest, AiContext, AiContextItem, AiContextKind, AiDisclosure, AiEmbeddingRequest, AiProvider, AiSourceSuggestion } from './model.js';
export type { LocalAiTransport } from './local-provider.js';
