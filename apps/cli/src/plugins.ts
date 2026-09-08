import { resolve } from 'node:path';

import { resolvedDocumentParaDto } from '@abnt/compiler';
import type { Diagnostic } from '@abnt/document-model';
import { PluginHost } from '@abnt/plugin-host';
import type { ResolvedDocument } from '@abnt/semantics';

/**
 * Roda cada plugin isolado no seu próprio processo (`PluginHost`) e devolve
 * os diagnósticos que produziram. Um plugin que trava, lança ou nunca
 * responde vira UM diagnóstico de aviso — não derruba o comando `lint`
 * inteiro por causa de código de terceiros mal comportado. Ver ADR 0020.
 */
export async function executarPluginsDeLint(
  caminhosDePlugin: readonly string[],
  resolvido: ResolvedDocument,
): Promise<readonly Diagnostic[]> {
  if (caminhosDePlugin.length === 0) return [];

  const documento = resolvedDocumentParaDto(resolvido);
  const resultados = await Promise.all(
    caminhosDePlugin.map(async (caminhoDoPlugin): Promise<readonly Diagnostic[]> => {
      const entryPath = resolve(caminhoDoPlugin);
      const host = new PluginHost(entryPath);
      try {
        return await host.lint(documento);
      } catch (erro) {
        return [
          {
            id: 'PLUGIN-FALHA',
            severity: 'warning',
            message: `Plugin "${caminhoDoPlugin}" falhou: ${erro instanceof Error ? erro.message : String(erro)}`,
          },
        ];
      } finally {
        host.dispose();
      }
    }),
  );
  return resultados.flat();
}
