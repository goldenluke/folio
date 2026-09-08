import {
  percorrer,
  type BlockNode,
  type Diagnostic,
  type DocumentAst,
  type InlineNode,
} from '@abnt/document-model';
import type { ResolvedDocument } from '@abnt/semantics';

/** Identidade versionada da fonte de uma regra, sem copiar seu texto. */
export interface ReferenciaDeNorma {
  readonly id: string;
  readonly version: string;
}

export interface ContextoDeValidacao {
  readonly document: ResolvedDocument;
}

export interface RegraDeValidacao {
  readonly id: string;
  readonly norma: ReferenciaDeNorma;
  validar(context: ContextoDeValidacao): readonly Diagnostic[];
}

export interface RelatorioDeValidacao {
  readonly normas: readonly ReferenciaDeNorma[];
  readonly diagnostics: readonly Diagnostic[];
  readonly errors: number;
  readonly warnings: number;
}

/** Executa um catálogo mantendo códigos de regra estáveis e rastreáveis. */
export function validar(
  rules: readonly RegraDeValidacao[],
  context: ContextoDeValidacao,
): RelatorioDeValidacao {
  const diagnostics = rules.flatMap((rule) => rule.validar(context));
  const normas = [...new Map(rules.map((rule) => [`${rule.norma.id}@${rule.norma.version}`, rule.norma])).values()];
  return {
    normas,
    diagnostics,
    errors: diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length,
    warnings: diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length,
  };
}

/** Profile sem norma: preserva diagnósticos semânticos, sem aplicar ABNT. */
export function validarSemNorma(document: ResolvedDocument): RelatorioDeValidacao {
  const diagnostics = document.diagnostics;
  return {
    normas: [],
    diagnostics,
    errors: diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length,
    warnings: diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length,
  };
}

export function textoDosInlines(nodes: readonly InlineNode[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case 'text':
        case 'code-inline':
        case 'math-inline':
          return node.value;
        case 'soft-break':
        case 'hard-break':
          return ' ';
        case 'emphasis':
        case 'strong':
        case 'strike':
        case 'link':
        case 'inline-container':
          return textoDosInlines(node.children);
        default:
          return '';
      }
    })
    .join(' ');
}

export function textoDosBlocos(nodes: readonly BlockNode[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case 'paragraph':
        case 'heading':
          return textoDosInlines(node.children);
        case 'section':
        case 'quote':
        case 'container':
        case 'list-item':
          return textoDosBlocos(node.children);
        case 'list':
          return textoDosBlocos(node.items);
        case 'table':
          return textoDosBlocos(node.body.flatMap((row) => row.cells.flatMap((cell) => cell.children)));
        case 'code-block':
        case 'math-block':
          return node.value;
        default:
          return '';
      }
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const palavrasDoResumo = (ast: DocumentAst): number => {
  const text = textoDosBlocos(ast.document.metadata.abstract ?? []);
  return text === '' ? 0 : text.split(/\s+/u).filter(Boolean).length;
};

/** Iteração única, exportada para regras que examinam elementos da árvore. */
export const nodesDoDocumento = (ast: DocumentAst) => [...percorrer(ast)];
