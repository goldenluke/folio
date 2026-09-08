import {
  percorrerTudo,
  type Diagnostic,
  type DocumentAst,
  type NodeId,
  type ReferenceId,
  type Registry,
  type SourceRange,
} from '@abnt/document-model';
import { anoDaReferencia, chaveDeAutor, compararReferencias } from '@abnt/bibliography';

export interface CitationResolution {
  /** Referências citadas, sem repetição, na ordem da primeira chamada. */
  readonly citedReferenceIds: readonly ReferenceId[];
  /** Número estável para o sistema numérico (1-based). */
  readonly numberByReference: ReadonlyMap<ReferenceId, number>;
  /** Sufixo a/b/c para obras do mesmo autor no mesmo ano. */
  readonly yearSuffixByReference: ReadonlyMap<ReferenceId, string>;
}

interface Occurrence {
  readonly referenceId: ReferenceId;
  readonly nodeId: NodeId;
  readonly source?: SourceRange;
}

function occurrences(ast: DocumentAst): readonly Occurrence[] {
  const result: Occurrence[] = [];

  for (const node of percorrerTudo(ast)) {
    if (node.type === 'citation') {
      for (const item of node.items) {
        result.push({
          referenceId: item.referenceId,
          nodeId: node.id,
          ...(node.source !== undefined ? { source: node.source } : {}),
        });
      }
      continue;
    }

    if (node.type === 'quote' || node.type === 'figure' || node.type === 'table') {
      for (const item of node.attribution?.citations ?? []) {
        result.push({
          referenceId: item.referenceId,
          nodeId: node.id,
          ...(node.source !== undefined ? { source: node.source } : {}),
        });
      }
    }
  }

  return result;
}

function alpha(index: number): string {
  let value = index + 1;
  let result = '';
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(97 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

/** Resolve relações bibliográficas sem alterar nenhum nó do Document AST. */
export function resolverCitacoes(
  ast: DocumentAst,
  bibliography: Registry<import('@abnt/document-model').BibliographicEntity> = ast.references,
): {
  readonly resolution: CitationResolution;
  readonly diagnostics: readonly Diagnostic[];
} {
  const seen = new Set<ReferenceId>();
  const citedReferenceIds: ReferenceId[] = [];
  const numberByReference = new Map<ReferenceId, number>();
  const diagnostics: Diagnostic[] = [];

  for (const occurrence of occurrences(ast)) {
    if (!seen.has(occurrence.referenceId)) {
      seen.add(occurrence.referenceId);
      citedReferenceIds.push(occurrence.referenceId);
      if (bibliography[occurrence.referenceId] !== undefined) {
        numberByReference.set(occurrence.referenceId, numberByReference.size + 1);
      }
    }

    if (bibliography[occurrence.referenceId] === undefined) {
      diagnostics.push({
        id: 'CIT-REF-AUSENTE',
        severity: 'error',
        message: `Citação referencia "${occurrence.referenceId}", que não existe na bibliografia.`,
        nodeId: occurrence.nodeId,
        ...(occurrence.source !== undefined ? { source: occurrence.source } : {}),
      });
    }
  }

  const groups = new Map<string, BibliographicGroup>();
  for (const referenceId of citedReferenceIds) {
    const item = bibliography[referenceId];
    if (item === undefined) continue;
    const key = `${chaveDeAutor(item)}\u0000${anoDaReferencia(item)}`;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }

  const yearSuffixByReference = new Map<ReferenceId, string>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    group.sort(compararReferencias).forEach((item, index) => {
      yearSuffixByReference.set(item.id, alpha(index));
    });
  }

  return {
    resolution: { citedReferenceIds, numberByReference, yearSuffixByReference },
    diagnostics,
  };
}

type BibliographicGroup = import('@abnt/document-model').BibliographicEntity[];
