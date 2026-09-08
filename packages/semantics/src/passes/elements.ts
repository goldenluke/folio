import type { AnyNode, Diagnostic, DocumentAst, NodeId } from '@abnt/document-model';
import { percorrer } from '@abnt/document-model';

import type { AnnotationStore } from '../annotations.js';

export const NUMERO_DA_FIGURA = 'semantic:figure-number' as const;
export const NUMERO_DA_TABELA = 'semantic:table-number' as const;
export const NUMERO_DA_EQUACAO = 'semantic:equation-number' as const;
export const NUMERO_DO_CODIGO = 'semantic:code-number' as const;

/** Identificador declarado pelo autor (`{#fig:arquitetura}`) -> nodeId. */
export const identificadorDe = (no: AnyNode): string | undefined =>
  no.attributes?.identifier;

/**
 * Numera figuras, tabelas, equações e listagens.
 *
 * Cada tipo tem sua própria sequência — "Figura 1" e "Tabela 1" coexistem, e é
 * assim que a ABNT numera. A ordem é a de aparição no documento, obtida da
 * travessia, e não a de declaração no fonte.
 *
 * Como em `numerarSecoes`, nada é escrito na AST: o número é dado derivado e
 * fica nas anotações. Ver docs/adr/0001.
 */
export function numerarElementos(ast: DocumentAst, anotacoes: AnnotationStore): void {
  const contadores = { figure: 0, table: 0, equation: 0, code: 0 };

  for (const no of percorrer(ast)) {
    switch (no.type) {
      case 'figure':
        contadores.figure += 1;
        anotacoes.set(no.id, NUMERO_DA_FIGURA, String(contadores.figure));
        break;
      case 'table':
        contadores.table += 1;
        anotacoes.set(no.id, NUMERO_DA_TABELA, String(contadores.table));
        break;
      case 'math-block':
        contadores.equation += 1;
        anotacoes.set(no.id, NUMERO_DA_EQUACAO, String(contadores.equation));
        break;
      case 'code-block':
        contadores.code += 1;
        anotacoes.set(no.id, NUMERO_DO_CODIGO, String(contadores.code));
        break;
      default:
        break;
    }
  }
}

/**
 * Índice `identificador declarado -> nodeId`, para resolver referências
 * cruzadas escritas contra um nome em vez de um id gerado.
 */
export function indexarIdentificadores(ast: DocumentAst): Map<string, NodeId> {
  return indexarIdentificadoresComDiagnosticos(ast).identifiers;
}

/** Índice de identificadores e erros de declarações ambíguas. */
export function indexarIdentificadoresComDiagnosticos(ast: DocumentAst): {
  readonly identifiers: Map<string, NodeId>;
  readonly diagnostics: readonly Diagnostic[];
} {
  const indice = new Map<string, NodeId>();
  const diagnostics: Diagnostic[] = [];
  for (const no of percorrer(ast)) {
    const ident = identificadorDe(no);
    if (ident === undefined) continue;
    if (!indice.has(ident)) {
      indice.set(ident, no.id);
      continue;
    }
    diagnostics.push({
      id: 'XREF-IDENTIFICADOR-DUPLICADO',
      severity: 'error',
      message: `O identificador "${ident}" foi declarado mais de uma vez.`,
      nodeId: no.id,
      ...(no.source !== undefined ? { source: no.source } : {}),
    });
  }
  return { identifiers: indice, diagnostics };
}
