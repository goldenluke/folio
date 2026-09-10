import { contextAsPrompt } from './context.js';
import type { AiCompletion, AiCompletionRequest, AiEmbeddingRequest, AiProvider } from './model.js';

export interface LocalAiTransport { post(path: string, body: unknown, signal?: AbortSignal): Promise<unknown>; }

/** Adapter for an OpenAI-compatible localhost endpoint; no provider name leaks into the core contract. */
export function createLocalAiProvider(options: { readonly transport: LocalAiTransport; readonly model: string; readonly label?: string }): AiProvider {
  const label = options.label ?? `Modelo local (${options.model})`;
  return {
    id: 'local', label,
    capabilities: () => ['complete', 'embed'],
    async complete(request: AiCompletionRequest, signal?: AbortSignal): Promise<AiCompletion> {
      const response = await options.transport.post('/v1/chat/completions', { model: options.model, temperature: request.temperature ?? 0.2, messages: [{ role: 'user', content: `${request.instruction}\n\nContexto selecionado:\n${contextAsPrompt(request.context)}` }] }, signal) as { choices?: readonly { message?: { content?: string } }[] };
      const text = response.choices?.[0]?.message?.content?.trim();
      if (text === undefined || text === '') throw new Error('O modelo local não devolveu uma resposta textual.');
      return { text, provider: 'local', model: options.model };
    },
    async embed(request: AiEmbeddingRequest, signal?: AbortSignal): Promise<readonly (readonly number[])[]> {
      const response = await options.transport.post('/v1/embeddings', { model: options.model, input: request.texts }, signal) as { data?: readonly { embedding?: readonly number[] }[] };
      const vectors = response.data?.map((item) => item.embedding).filter((embedding): embedding is readonly number[] => embedding !== undefined);
      if (vectors === undefined || vectors.length !== request.texts.length) throw new Error('O modelo local não devolveu embeddings válidos.');
      return vectors;
    },
  };
}
