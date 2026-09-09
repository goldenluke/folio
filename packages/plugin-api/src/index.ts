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
  FOLIO_PLUGIN_API_VERSION,
  type FolioPluginCapability,
  type FolioPluginManifest,
  type FolioPluginViewContribution,
  type FolioPluginCommandContribution,
  type FolioPluginExportContribution,
  type PluginCommandContext,
  type PluginCommandResult,
  type PluginExportResult,
  type FolioProductPlugin,
  type PluginCommandRequestMessage,
  type PluginCommandResponseMessage,
  type PluginExportRequestMessage,
  type PluginExportResponseMessage,
} from './model.js';
export { folioPluginManifestSchema, pluginCommandRequestMessageSchema, pluginCommandResponseMessageSchema, pluginExportRequestMessageSchema, pluginExportResponseMessageSchema, pluginLintRequestMessageSchema, pluginLintResponseMessageSchema, pluginReadyMessageSchema } from './schemas.js';
export { runFolioPlugin, runLintPlugin } from './runtime.js';
