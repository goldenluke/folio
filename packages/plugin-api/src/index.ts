/**
 * @abnt/plugin-api — contrato entre um plugin de lint de terceiros e o host
 * que o executa isolado (`@abnt/plugin-host`).
 *
 * Só conhece `@abnt/protocol` (DTOs serializáveis) e `zod`. Nunca markdown,
 * standards, semantics ou compiler — um plugin não reimplementa a norma, só
 * lê o documento já resolvido e devolve diagnósticos.
 */

export {
  PLUGIN_PROTOCOL_VERSION,
  type AbntLintPlugin,
  type AbntLintPluginInfo,
  type PluginLintRequestMessage,
  type PluginLintResponseMessage,
  type PluginOutboundMessage,
  type PluginReadyMessage,
} from './model.js';
export { pluginLintRequestMessageSchema, pluginLintResponseMessageSchema, pluginReadyMessageSchema } from './schemas.js';
export { runLintPlugin } from './runtime.js';
