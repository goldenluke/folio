import type { NodeId } from './ids.js';
import type { SourceRange } from './source.js';

export type Severidade = 'info' | 'warning' | 'error';

/**
 * Diagnóstico do compilador ou de uma norma.
 *
 * Mora em `document-model` porque toda camada produz diagnóstico — o parser
 * reclama de frontmatter inválido, a semântica de referência cruzada
 * pendurada, a norma de citação sem página. Deixar o tipo numa camada acima
 * forçaria as de baixo a importar para cima.
 *
 * `id` é código estável e citável (`ABNT-10520-CIT-004`), não texto livre: o
 * usuário precisa poder silenciar uma regra, buscar por ela e vê-la
 * referenciada na documentação. Mensagem muda; código não.
 */
export interface Diagnostic {
  readonly id: string;
  readonly severity: Severidade;
  readonly message: string;
  readonly nodeId?: NodeId;
  readonly source?: SourceRange;
}
