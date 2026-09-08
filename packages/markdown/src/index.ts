/**
 * @abnt/markdown — sintaxe de autoria -> modelo semântico.
 *
 * INVARIANTE: produz estrutura, não julgamento. Nenhuma regra ABNT aqui.
 * O parser não sabe que artigo precisa de resumo; isso é do @abnt/standards.
 */

export { parseMarkdown, parseMarkdownComDiagnosticos } from './parse.js';
export type { OpcoesDeParse, ResultadoDoParse } from './parse.js';
export { extrairFrontmatter } from './frontmatter.js';
export type {
  FrontmatterExtraida,
  ProblemaDeFrontmatter,
} from './frontmatter.js';
export { metadadosDeFrontmatter } from './metadata.js';
export { expandMarkdownComposition, resolveCompositionPath } from './transclusion.js';
export type { SourceCompositionRequest, SourceCompositionResult, TransclusionReader } from './transclusion.js';
