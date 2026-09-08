/**
 * @abnt/semantics — passes que transformam a AST crua em ResolvedDocument.
 *
 * Resolve o que é derivável do próprio documento (numeração, referências
 * cruzadas, ligação citação->entrada bibliográfica). Não aplica norma: o que
 * sai daqui vale igual para ABNT, APA ou IEEE.
 */

export { AnnotationStore } from './annotations.js';
export type { AnnotationKey, NodeAnnotations } from './annotations.js';

export { numerarSecoes, NUMERO_DA_SECAO, NIVEL_DA_SECAO } from './passes/numbering.js';
export type { OpcoesDeNumeracao } from './passes/numbering.js';

export { normalizarDocumento } from './passes/normalization.js';

export {
  identificadorDe,
  indexarIdentificadores,
  indexarIdentificadoresComDiagnosticos,
  numerarElementos,
  NUMERO_DA_FIGURA,
  NUMERO_DA_TABELA,
  NUMERO_DA_EQUACAO,
  NUMERO_DO_CODIGO,
} from './passes/elements.js';

export {
  ALVO_DA_REFERENCIA_CRUZADA,
  TEXTO_DA_REFERENCIA_CRUZADA,
  resolverReferenciasCruzadas,
} from './passes/cross-references.js';
export { executarPasses } from './passes/pipeline.js';
export type { SemanticPass } from './passes/pipeline.js';

export { executarPassesSemanticos, PASSES_SEMANTICOS, resolverDocumento } from './resolve.js';
export type {
  ContextoSemantico,
  EstadoSemantico,
  OpcoesDeResolucao,
  ResolvedDocument,
} from './resolve.js';
export { resolverCitacoes } from './passes/citations.js';
export type { CitationResolution } from './passes/citations.js';

// Reexportados por conveniência. O tipo mora no modelo porque parsing,
// resolução, normas e publicação podem produzir diagnósticos sem dependerem
// entre si.
export type { Diagnostic, Severidade } from '@abnt/document-model';
