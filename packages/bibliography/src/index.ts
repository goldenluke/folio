/**
 * @abnt/bibliography — modelo bibliográfico canônico.
 *
 * Implementado no M2 sob a decisão registrada em docs/adr/0002:
 *
 *   - o modelo canônico adota o *schema* CSL-JSON (interop com Zotero,
 *     Mendeley e Crossref sem custo), mas
 *   - NÃO usamos nenhum processador CSL pronto: `citeproc-js` é CPAL/AGPL
 *     (incompatível com o modelo comercial) e `citeproc-rs` foi arquivado
 *     pela Zotero em 13/08/2026, incompleto.
 *
 * Portanto o motor de citação ABNT é escrito aqui e em `@abnt/standards`.
 * É viável porque precisamos de uma família de estilos, não das 10.000 do CSL.
 *
 * O gate `pnpm check:licenses` quebra o build se alguém instalar citeproc.
 */

export { importarBibtex } from './importar-bibtex.js';
export type {
  OpcoesDeImportacaoBibtex,
  ResultadoDaImportacaoBibtex,
} from './importar-bibtex.js';
export { exportarBibtex, exportarEntradaBibtex } from './exportar-bibtex.js';

export { importarRis, exportarRis } from './ris.js';
export type { OpcoesDeImportacaoRis, ResultadoDaImportacaoRis } from './ris.js';

export { importarCslJson, exportarCslJson } from './csl-json.js';
export type { ResultadoDaImportacaoCslJson } from './csl-json.js';

export {
  anoDaReferencia,
  autorDaChamada,
  autorDaChamadaParentetica,
  chaveDeAutor,
  compararReferencias,
} from './citacoes.js';

export { formatarReferenciaAbnt, referenciaComoTexto } from './referencias-abnt.js';
export type { ReferenciaFormatada, TrechoBibliografico } from './referencias-abnt.js';
export { findReferenceDuplicates } from './duplicates.js';
export type { DuplicateReason, ReferenceDuplicate } from './duplicates.js';
