import { z } from 'zod';

import {
  asReferenceId,
  cslBibliographicEntityV1,
  type BibliographicEntity,
  type Diagnostic,
  type Registry,
} from '@abnt/document-model';

export interface ResultadoDaImportacaoCslJson {
  readonly references: Registry<BibliographicEntity>;
  readonly diagnostics: readonly Diagnostic[];
}

/** CSL-JSON "solto" aceita tanto array (formato padrão/Zotero) quanto objeto por id. */
const cslJsonDocumentSchema = z.union([
  z.array(cslBibliographicEntityV1),
  z.record(z.string(), cslBibliographicEntityV1),
]);

/**
 * Importa CSL-JSON puro (não o registry interno do Document AST, que já usa
 * este mesmo subschema) para o registry canônico. Reaproveita
 * `cslBibliographicEntityV1` de `@abnt/document-model` — a MESMA validação
 * que o schema do documento já usa para o campo `references`, nunca uma
 * segunda definição do formato CSL.
 */
export function importarCslJson(fonte: string): ResultadoDaImportacaoCslJson {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fonte);
  } catch (error) {
    return {
      references: {},
      diagnostics: [{ id: 'CSL-JSON-SINTAXE', severity: 'error', message: `JSON inválido: ${(error as Error).message}` }],
    };
  }

  const checked = cslJsonDocumentSchema.safeParse(parsed);
  if (!checked.success) {
    return {
      references: {},
      diagnostics: checked.error.issues.map((issue) => ({
        id: 'CSL-JSON-ESQUEMA',
        severity: 'error' as const,
        message: `${issue.path.join('.') || '(raiz)'}: ${issue.message}`,
      })),
    };
  }

  const items = Array.isArray(checked.data) ? checked.data : Object.values(checked.data);
  const references: Record<string, BibliographicEntity> = {};
  const diagnostics: Diagnostic[] = [];
  for (const item of items) {
    if (references[item.id] !== undefined) {
      diagnostics.push({ id: 'CSL-JSON-CHAVE-DUPLICADA', severity: 'error', message: `A chave "${item.id}" aparece mais de uma vez.` });
      continue;
    }
    // zod tipifica campo opcional ausente como `T | undefined` explícito;
    // o round-trip por JSON restaura a forma real (chave ausente, não
    // presente com valor `undefined`) exigida por `exactOptionalPropertyTypes`.
    const cleaned = JSON.parse(JSON.stringify(item)) as Omit<BibliographicEntity, 'id'>;
    references[item.id] = { ...cleaned, id: asReferenceId(item.id) };
  }
  return { references, diagnostics };
}

/** Serializa como array CSL-JSON (o formato que Zotero/Mendeley também produzem), legível para diff. */
export function exportarCslJson(entries: Registry<BibliographicEntity>): string {
  const items = Object.entries(entries)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, entry]) => ({ ...entry, id }));
  return `${JSON.stringify(items, null, 2)}\n`;
}
