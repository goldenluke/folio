import {
  indexarPorId,
  percorrerTudo,
  type AnyNode,
  type CrossReferenceNode,
  type Diagnostic,
  type DocumentAst,
  type NodeId,
} from '@abnt/document-model';

import type { AnnotationStore } from '../annotations.js';
import {
  NUMERO_DA_EQUACAO,
  NUMERO_DA_FIGURA,
  NUMERO_DA_TABELA,
  NUMERO_DO_CODIGO,
} from './elements.js';
import { NUMERO_DA_SECAO } from './numbering.js';

/** Nó alvo resolvido; a relação continua fora da AST imutável. */
export const ALVO_DA_REFERENCIA_CRUZADA = 'semantic:cross-reference-target' as const;
/** Texto lógico já escolhido para a referência, pronto para a publicação. */
export const TEXTO_DA_REFERENCIA_CRUZADA = 'semantic:cross-reference-text' as const;

const nomeDoAlvo = (reference: CrossReferenceNode): string =>
  reference.target.kind === 'identifier'
    ? reference.target.identifier
    : String(reference.target.nodeId);

function textoPuro(nodes: readonly import('@abnt/document-model').InlineNode[] | undefined): string {
  if (nodes === undefined) return '';
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
          return textoPuro(node.children);
        default:
          return '';
      }
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

interface RepresentacaoDoAlvo {
  readonly label?: string;
  readonly number?: string;
  readonly title?: string;
}

const representacao = (
  label: string,
  number: string | undefined,
  title: string,
): RepresentacaoDoAlvo => ({
  label,
  ...(number !== undefined ? { number } : {}),
  ...(title !== '' ? { title } : {}),
});

function representacaoDoAlvo(no: AnyNode, annotations: AnnotationStore): RepresentacaoDoAlvo {
  switch (no.type) {
    case 'section':
      return representacao(
        'Seção',
        annotations.getString(no.id, NUMERO_DA_SECAO),
        textoPuro(no.title),
      );
    case 'figure':
      return representacao(
        'Figura',
        annotations.getString(no.id, NUMERO_DA_FIGURA),
        textoPuro(no.caption?.short),
      );
    case 'table':
      return representacao(
        'Tabela',
        annotations.getString(no.id, NUMERO_DA_TABELA),
        textoPuro(no.caption?.short),
      );
    case 'math-block':
      return representacao(
        'Equação',
        annotations.getString(no.id, NUMERO_DA_EQUACAO),
        textoPuro(no.caption?.short),
      );
    case 'code-block':
      return representacao(
        'Código',
        annotations.getString(no.id, NUMERO_DO_CODIGO),
        textoPuro(no.caption?.short),
      );
    case 'heading':
      return { title: textoPuro(no.children) };
    default:
      return {};
  }
}

function apresentar(
  reference: CrossReferenceNode,
  target: RepresentacaoDoAlvo,
): string | undefined {
  const mode = reference.presentation ?? 'label';
  const labelled = [target.label, target.number].filter(Boolean).join(' ');

  switch (mode) {
    case 'number':
      return target.number;
    case 'label':
      return labelled || target.title;
    case 'title':
      return target.title;
    case 'full':
      if (labelled !== '' && target.title !== undefined && target.title !== '') {
        return `${labelled} — ${target.title}`;
      }
      return labelled || target.title;
    default:
      return undefined;
  }
}

/**
 * Resolve identificadores e escolhe uma apresentação lógica para cada
 * referência cruzada. A regra não conhece ABNT, nem produz layout: ela só
 * relaciona nós e converte `presentation` em texto semântico derivado.
 */
export function resolverReferenciasCruzadas(
  ast: DocumentAst,
  annotations: AnnotationStore,
  identifiers: ReadonlyMap<string, NodeId>,
): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const nodes = indexarPorId(ast);

  for (const node of percorrerTudo(ast)) {
    if (node.type !== 'cross-reference') continue;

    const targetId =
      node.target.kind === 'node' ? node.target.nodeId : identifiers.get(node.target.identifier);
    const target = targetId === undefined ? undefined : nodes.get(targetId);

    if (target === undefined) {
      diagnostics.push({
        id: 'XREF-NAO-RESOLVIDA',
        severity: 'error',
        message: `Referência cruzada para "${nomeDoAlvo(node)}" não pôde ser resolvida.`,
        nodeId: node.id,
        ...(node.source !== undefined ? { source: node.source } : {}),
      });
      continue;
    }

    const text = apresentar(node, representacaoDoAlvo(target, annotations));
    if (text === undefined || text === '') {
      diagnostics.push({
        id: 'XREF-ALVO-NAO-PUBLICAVEL',
        severity: 'error',
        message: `O alvo "${nomeDoAlvo(node)}" não oferece a apresentação solicitada pela referência cruzada.`,
        nodeId: node.id,
        ...(node.source !== undefined ? { source: node.source } : {}),
      });
      continue;
    }

    annotations.set(node.id, ALVO_DA_REFERENCIA_CRUZADA, String(target.id));
    annotations.set(node.id, TEXTO_DA_REFERENCIA_CRUZADA, text);
  }

  return diagnostics;
}
