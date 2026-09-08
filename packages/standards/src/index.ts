/**
 * @abnt/standards — normas como módulos versionados.
 *
 * INVARIANTE: opera sobre o modelo semântico resolvido. Nunca vê Markdown
 * (entrada) nem HTML (saída). Fiscalizado em `pnpm check:boundaries`.
 *
 * Uma norma faz duas coisas distintas, que este package mantém separadas:
 *   validação  — "este documento está conforme?"  -> Diagnostic[]
 *   publicação — "como ele deve ser apresentado?" -> PublicationProfile
 *
 * O ano faz parte da identidade: `abnt:nbr-10520@2023` não é o mesmo módulo
 * que `abnt:nbr-10520@2002`, e documentos antigos precisam continuar
 * compilando sob a norma sob a qual foram escritos.
 */

export { perfilArtigoAbnt, perfilArtigoAbntNumerico } from './abnt/artigo.js';
export { perfilTccAbnt } from './abnt/tcc.js';
export { perfilArtigoWeb } from './web/article.js';
export { motorAutorDataAbnt, motorNumericoAbnt, textoDaCitacao } from './abnt/citacoes.js';
export {
  LIMITES_PADRAO_DO_RESUMO_DE_ARTIGO,
  REGRAS_DO_ARTIGO_ABNT,
  regraDoResumo,
  validarArtigoAbnt,
} from './abnt/validation.js';
export type { LimitesDoResumo } from './abnt/validation.js';
export { REGRAS_DO_TCC_ABNT, validarTccAbnt } from './abnt/tcc-validation.js';
export { validar, validarSemNorma } from './validation.js';
export type {
  ContextoDeValidacao,
  ReferenciaDeNorma,
  RegraDeValidacao,
  RelatorioDeValidacao,
} from './validation.js';
