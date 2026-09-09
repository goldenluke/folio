import { PLUGIN_PROTOCOL_VERSION, type AbntLintPlugin, type FolioProductPlugin } from './model.js';
import { pluginCommandRequestMessageSchema, pluginExportRequestMessageSchema, pluginLintRequestMessageSchema } from './schemas.js';

/**
 * Ponte entre um arquivo de plugin e o `PluginHost` que o hospeda. Um plugin
 * chama isso e nada mais — não conhece `child_process`, não sabe que fala
 * IPC. Precisa rodar como processo filho com canal de mensagens
 * (`child_process.fork`), não em qualquer contexto Node.
 */
export function runLintPlugin(plugin: AbntLintPlugin): void {
  if (typeof process.send !== 'function') {
    throw new Error('runLintPlugin precisa rodar como processo filho com canal IPC (child_process.fork).');
  }

  process.send({
    version: PLUGIN_PROTOCOL_VERSION,
    type: 'abnt-plugin/ready',
    plugin: { id: plugin.id, version: plugin.version, ...(plugin.norma !== undefined ? { norma: plugin.norma } : {}) },
  });

  process.on('message', (raw: unknown) => {
    const parsed = pluginLintRequestMessageSchema.safeParse(raw);
    if (!parsed.success) return;
    const { requestId, document } = parsed.data;
    Promise.resolve(plugin.lint(document))
      .then((diagnostics) => {
        process.send?.({ version: PLUGIN_PROTOCOL_VERSION, type: 'abnt-plugin/lint-result', requestId, ok: true, diagnostics });
      })
      .catch((error: unknown) => {
        process.send?.({
          version: PLUGIN_PROTOCOL_VERSION,
          type: 'abnt-plugin/lint-result',
          requestId,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      });
  });
}

/**
 * Runtime de produto: somente comandos declarativos e exportação textual
 * passam pelo IPC. Não há acesso ao React, DOM, WorkspaceLanguageService ou
 * filesystem oferecido pelo Folio; isolamento continua sendo contenção, não
 * sandbox de segurança.
 */
export function runFolioPlugin(plugin: FolioProductPlugin): void {
  if (typeof process.send !== 'function') throw new Error('runFolioPlugin precisa rodar como processo filho com canal IPC.');
  process.send({ version: PLUGIN_PROTOCOL_VERSION, type: 'abnt-plugin/ready', plugin: { id: plugin.id, version: plugin.version, ...(plugin.norma === undefined ? {} : { norma: plugin.norma }) } });
  process.on('message', (raw: unknown) => {
    const lint = pluginLintRequestMessageSchema.safeParse(raw);
    if (lint.success && plugin.lint !== undefined) { void Promise.resolve(plugin.lint(lint.data.document)).then((diagnostics) => process.send?.({ version: PLUGIN_PROTOCOL_VERSION, type: 'abnt-plugin/lint-result', requestId: lint.data.requestId, ok: true, diagnostics })).catch((error: unknown) => process.send?.({ version: PLUGIN_PROTOCOL_VERSION, type: 'abnt-plugin/lint-result', requestId: lint.data.requestId, ok: false, error: error instanceof Error ? error.message : String(error) })); return; }
    const command = pluginCommandRequestMessageSchema.safeParse(raw);
    if (command.success) { void Promise.resolve(plugin.command?.(command.data.commandId, command.data.context) ?? { kind: 'notice', message: 'Comando não suportado pelo plugin.' }).then((result) => process.send?.({ version: PLUGIN_PROTOCOL_VERSION, type: 'abnt-plugin/command-result', requestId: command.data.requestId, ok: true, result })).catch((error: unknown) => process.send?.({ version: PLUGIN_PROTOCOL_VERSION, type: 'abnt-plugin/command-result', requestId: command.data.requestId, ok: false, error: error instanceof Error ? error.message : String(error) })); return; }
    const exported = pluginExportRequestMessageSchema.safeParse(raw);
    if (exported.success) { void Promise.resolve(plugin.export?.(exported.data.exportId, exported.data.publication) ?? { content: '' }).then((result) => process.send?.({ version: PLUGIN_PROTOCOL_VERSION, type: 'abnt-plugin/export-result', requestId: exported.data.requestId, ok: true, result })).catch((error: unknown) => process.send?.({ version: PLUGIN_PROTOCOL_VERSION, type: 'abnt-plugin/export-result', requestId: exported.data.requestId, ok: false, error: error instanceof Error ? error.message : String(error) })); }
  });
}
