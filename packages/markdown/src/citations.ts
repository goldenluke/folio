import type { CitationItem, CitationNode, InlineNode, Locator, LocatorType, NodeIdFactory, SourceRange, TextNode } from '@abnt/document-model';
import { asReferenceId } from '@abnt/document-model';

/**
 * Reconhecimento de citações no estilo Pandoc.
 *
 *   [@silva2024]                 parentética
 *   [@silva2024, p. 42]          com localizador
 *   [@silva2024; @souza2023]     múltiplas entradas
 *   [ver @silva2024, cap. 3]     com prefixo
 *   @silva2024                   narrativa
 *
 * Implementado por varredura dos nós de texto já parseados, e não por extensão
 * do micromark. É bem mais simples, e o custo — não funcionar dentro de
 * construções que o micromark já consumiu, como código — na verdade é o
 * comportamento desejado: `[@x]` dentro de crase deve permanecer literal.
 *
 * Os offsets são recalculados a partir do offset do nó de texto original, de
 * modo que os diagnósticos continuam apontando para a posição certa no arquivo.
 */

/** Chave de referência: letras, dígitos, `_`, `-`, `:`, `.` — sem espaço. */
const CHAVE = '[A-Za-z0-9_][A-Za-z0-9_:.#$%&+?<>~/-]*';

const CITACAO_PARENTETICA = new RegExp(`\\[([^\\][]*@${CHAVE}[^\\][]*)\\]`, 'g');
/** Narrativa aceita locator explícito: `@silva2024 [p. 42]`. */
const CITACAO_NARRATIVA = new RegExp(`(^|[^A-Za-z0-9_@\`])@(${CHAVE})(?:\\s+\\[([^\\][]+)\\])?`, 'g');

/** Abreviaturas de localizador reconhecidas, em português e inglês. */
const LOCALIZADORES: ReadonlyArray<readonly [RegExp, LocatorType]> = [
  [/^(?:pp?\.|páginas?|paginas?|pages?)\s*/i, 'page'],
  [/^(?:caps?\.|capítulos?|capitulos?|chap(?:ter)?s?\.?)\s*/i, 'chapter'],
  [/^(?:se(?:ç|c)(?:ão|ao|tion)s?\.?|se(?:c|ç)s?\.)\s*/i, 'section'],
  [/^(?:par(?:ágrafo|agrafo|a)?s?\.?|§)\s*/i, 'paragraph'],
  [/^(?:vols?\.|volumes?)\s*/i, 'volume'],
  [/^(?:n(?:os?)?\.|números?|numeros?|issues?)\s*/i, 'issue'],
  [/^(?:figs?\.|figuras?|figures?)\s*/i, 'figure'],
  [/^(?:tabs?\.|tabelas?|tables?)\s*/i, 'table'],
];

/**
 * Interpreta o sufixo de uma entrada: ", p. 42" -> localizador de página.
 *
 * Sem abreviatura reconhecida mas com cara de número, assume página: é a
 * convenção do Pandoc e o caso esmagadoramente mais comum.
 */
function interpretarLocalizador(sufixo: string): Locator | undefined {
  const texto = sufixo.trim().replace(/^,\s*/, '');
  if (texto === '') return undefined;

  for (const [padrao, tipo] of LOCALIZADORES) {
    if (padrao.test(texto)) {
      const valor = texto.replace(padrao, '').trim();
      if (valor !== '') return { type: tipo, value: valor };
    }
  }

  if (/^[\d]+(?:\s*[-–—]\s*\d+)?$/.test(texto)) {
    return { type: texto.includes('-') || texto.includes('–') ? 'page-range' : 'page', value: texto };
  }

  return undefined;
}

/** Separa um locator conhecido do sufixo livre sem fazer o sufixo virar página. */
function interpretarSufixo(sufixoBruto: string): { readonly locator?: Locator; readonly suffix?: string } {
  const texto = sufixoBruto.trim().replace(/^,\s*/, '');
  if (texto === '') return {};
  const comma = texto.indexOf(',');
  if (comma >= 0) {
    const locator = interpretarLocalizador(texto.slice(0, comma));
    const suffix = texto.slice(comma + 1).trim();
    if (locator !== undefined) return { locator, ...(suffix === '' ? {} : { suffix }) };
  }
  const locator = interpretarLocalizador(texto);
  return locator === undefined ? { suffix: texto } : { locator };
}

interface ContextoDeCitacao {
  readonly ids: NodeIdFactory;
  readonly intervalo: (inicio: number, fim: number) => SourceRange | undefined;
}

/** Divide o conteúdo de `[...]` em entradas separadas por `;`. */
function interpretarEntradas(conteudo: string, ctx: ContextoDeCitacao): CitationItem[] {
  const itens: CitationItem[] = [];

  for (const parte of conteudo.split(';')) {
    const m = new RegExp(`^(.*?)(-)?@(${CHAVE})(.*)$`, 's').exec(parte);
    if (m === null) continue;

    const [, prefixoBruto = '', supressao, chave = '', sufixoBruto = ''] = m;
    const prefixo = prefixoBruto.trim();
    const interpretedSuffix = interpretarSufixo(sufixoBruto);
    const locator = interpretedSuffix.locator;
    const restoDoSufixo = interpretedSuffix.suffix ?? '';

    const prefixoNos: InlineNode[] =
      prefixo === ''
        ? []
        : [{ id: ctx.ids.proximo(), type: 'text', value: prefixo } satisfies TextNode];

    const sufixoNos: InlineNode[] =
      restoDoSufixo === ''
        ? []
        : [{ id: ctx.ids.proximo(), type: 'text', value: restoDoSufixo } satisfies TextNode];

    itens.push({
      referenceId: asReferenceId(chave),
      ...(prefixoNos.length > 0 ? { prefix: prefixoNos } : {}),
      ...(sufixoNos.length > 0 ? { suffix: sufixoNos } : {}),
      ...(locator !== undefined ? { locator } : {}),
      // `-@chave` suprime o autor: "Silva (-@silva2024)" -> "(2024)".
      ...(supressao === '-' ? { suppressAuthor: true } : {}),
    });
  }

  return itens;
}

/**
 * Varre um nó de texto e o substitui pela sequência texto/citação/texto.
 *
 * `deslocamento` é o offset absoluto do início deste texto no arquivo, para
 * que os SourceRanges gerados sejam absolutos e não relativos ao nó.
 */
export function extrairCitacoes(
  no: TextNode,
  deslocamento: number,
  ctx: ContextoDeCitacao,
): InlineNode[] {
  const texto = no.value;

  interface Achado {
    readonly inicio: number;
    readonly fim: number;
    readonly itens: CitationItem[];
    readonly modo: 'parenthetical' | 'narrative';
  }

  const achados: Achado[] = [];

  CITACAO_PARENTETICA.lastIndex = 0;
  for (let m = CITACAO_PARENTETICA.exec(texto); m !== null; m = CITACAO_PARENTETICA.exec(texto)) {
    const itens = interpretarEntradas(m[1] ?? '', ctx);
    if (itens.length > 0) {
      achados.push({
        inicio: m.index,
        fim: m.index + m[0].length,
        itens,
        modo: 'parenthetical',
      });
    }
  }

  CITACAO_NARRATIVA.lastIndex = 0;
  for (let m = CITACAO_NARRATIVA.exec(texto); m !== null; m = CITACAO_NARRATIVA.exec(texto)) {
    const inicio = m.index + (m[1] ?? '').length;
    const chaveBruta = m[2] ?? '';
    // `.` é válido dentro de chaves BibTeX, mas no fim de uma frase pertence
    // à prosa: `@silva2024.` não pode procurar a chave `silva2024.`.
    const chave = chaveBruta.replace(/[.,;:!?]+$/u, '');
    const locatorBruto = m[3];
    const locator = locatorBruto === undefined ? undefined : interpretarLocalizador(locatorBruto);
    const fim = locatorBruto === undefined
      ? inicio + 1 + chave.length
      : inicio + m[0].length - (m[1] ?? '').length;
    if (chave === '') continue;

    // Uma citação narrativa dentro de uma parentética já foi consumida.
    const dentroDeOutra = achados.some((a) => inicio >= a.inicio && fim <= a.fim);
    if (dentroDeOutra) continue;

    achados.push({
      inicio,
      fim,
      itens: [{ referenceId: asReferenceId(chave), ...(locator === undefined ? {} : { locator }) }],
      modo: 'narrative',
    });
  }

  if (achados.length === 0) return [no];

  achados.sort((a, b) => a.inicio - b.inicio);

  const saida: InlineNode[] = [];
  let cursor = 0;

  for (const achado of achados) {
    if (achado.inicio < cursor) continue; // sobreposição: ignora a segunda

    if (achado.inicio > cursor) {
      const trecho = texto.slice(cursor, achado.inicio);
      const r = ctx.intervalo(deslocamento + cursor, deslocamento + achado.inicio);
      saida.push({
        id: ctx.ids.proximo(),
        type: 'text',
        value: trecho,
        ...(r !== undefined ? { source: r } : {}),
      });
    }

    const r = ctx.intervalo(deslocamento + achado.inicio, deslocamento + achado.fim);
    const citacao: CitationNode = {
      id: ctx.ids.proximo(),
      type: 'citation',
      mode: achado.modo,
      items: achado.itens,
      ...(r !== undefined ? { source: r } : {}),
    };
    saida.push(citacao);

    cursor = achado.fim;
  }

  if (cursor < texto.length) {
    const r = ctx.intervalo(deslocamento + cursor, deslocamento + texto.length);
    saida.push({
      id: ctx.ids.proximo(),
      type: 'text',
      value: texto.slice(cursor),
      ...(r !== undefined ? { source: r } : {}),
    });
  }

  return saida;
}
