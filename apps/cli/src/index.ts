export { compilar, obterPerfil, PERFIS, PERFIL_PADRAO } from './pipeline.js';
export type { EtapasDaCompilacao, OpcoesDaCompilacao } from './pipeline.js';
export { gerarPdf, encontrarChrome } from '@abnt/renderer-pdf';
export type { OpcoesDePdf, ResultadoDePdf } from '@abnt/renderer-pdf';
export { renderizarDocx } from '@abnt/renderer-docx';
export { formatarDiagnosticos, resumo } from './report.js';
export { prepararAmbienteLocal } from './environment.js';
export type { OpcoesDeAmbienteLocal } from './environment.js';
