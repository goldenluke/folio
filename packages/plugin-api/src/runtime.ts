import { PLUGIN_PROTOCOL_VERSION, type AbntLintPlugin } from './model.js';
import { pluginLintRequestMessageSchema } from './schemas.js';

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
