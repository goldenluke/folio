import type {
  BlockNode,
  Caption,
  Attribution,
  DocumentAst,
  InlineNode,
  NoteId,
  Registry,
  RichText,
  Resource,
} from '@abnt/document-model';
import type { Diagnostic, ResolvedDocument } from '@abnt/semantics';
import {
  NUMERO_DA_EQUACAO,
  NUMERO_DA_FIGURA,
  NUMERO_DA_SECAO,
  NUMERO_DA_TABELA,
  NUMERO_DO_CODIGO,
  TEXTO_DA_REFERENCIA_CRUZADA,
} from '@abnt/semantics';

import type {
  PublicationBlock,
  PublicationCaption,
  PublicationDocument,
  PublicationInline,
  PublicationNote,
  PublicationTableRow,
} from './model.js';
import type { PublicationProfile, TipoDeLegenda } from './profile.js';
import { motorDeCitacaoProvisorio } from './profile.js';

/** Achata inline em string. Usado onde a saída precisa de texto puro. */
export function textoPuro(nodes: readonly InlineNode[] | undefined): string {
  if (nodes === undefined) return '';
  let saida = '';
  for (const n of nodes) {
    switch (n.type) {
      case 'text':
        saida += n.value;
        break;
      case 'code-inline':
      case 'math-inline':
        saida += n.value;
        break;
      case 'soft-break':
        saida += ' ';
        break;
      case 'hard-break':
        saida += '\n';
        break;
      case 'emphasis':
      case 'strong':
      case 'strike':
      case 'link':
      case 'inline-container':
        saida += textoPuro(n.children);
        break;
      default:
        break;
    }
  }
  return saida;
}

const ANOTACAO_POR_TIPO = {
  figure: NUMERO_DA_FIGURA,
  table: NUMERO_DA_TABELA,
  equation: NUMERO_DA_EQUACAO,
  code: NUMERO_DO_CODIGO,
} as const;

/** Rótulo padrão quando o profile não define `formatarLegenda`. */
const ROTULO_PADRAO: Record<TipoDeLegenda, string> = {
  figure: 'Figura',
  table: 'Tabela',
  equation: 'Equação',
  code: 'Código',
};

/**
 * ResolvedDocument + profile -> Publication AST.
 *
 * O que este passo resolve, e por isso o renderer não precisa saber:
 *   - numeração de seção e de elemento vira texto ("2.1", "Figura 3")
 *   - hierarquia de seções vira sequência linear de headings com nível
 *   - citações passam pelo motor e chegam formatadas
 *   - notas são coletadas, numeradas e separadas do corpo
 *   - recursos são resolvidos de id para URI
 *   - cada bloco recebe um token de estilo
 */
export interface OpcoesDeCompilacaoDePublicacao {
  /** Recursos resolvidos pelo host; fallback preserva uso direto do package. */
  readonly resources?: Registry<Resource>;
}

export function compilarPublicacao(
  doc: ResolvedDocument,
  profile: PublicationProfile,
  opcoes: OpcoesDeCompilacaoDePublicacao = {},
): { readonly documento: PublicationDocument; readonly diagnosticos: readonly Diagnostic[] } {
  const { ast, annotations } = doc;
  const resources = opcoes.resources ?? ast.resources;
  const diagnosticos: Diagnostic[] = [];
  const motor = profile.motorDeCitacao ?? motorDeCitacaoProvisorio;
  const t = profile.tokens;
  const contextoDeCitacao = {
    references: doc.bibliography,
    numberByReference: doc.citations.numberByReference,
    yearSuffixByReference: doc.citations.yearSuffixByReference,
  };
  diagnosticos.push(...(motor.validarDocumento?.(doc) ?? []));

  // Notas são numeradas na ordem em que a chamada aparece no texto, não na
  // ordem em que foram definidas no fonte.
  const ordemDasNotas: NoteId[] = [];
  const marcadorDeNota = (noteId: NoteId): string => {
    let indice = ordemDasNotas.indexOf(noteId);
    if (indice === -1) {
      ordemDasNotas.push(noteId);
      indice = ordemDasNotas.length - 1;
    }
    return profile.marcadorDeNota?.(indice + 1) ?? String(indice + 1);
  };

  function inline(nodes: readonly InlineNode[]): PublicationInline[] {
    const saida: PublicationInline[] = [];

    for (const n of nodes) {
      switch (n.type) {
        case 'text':
          saida.push({ type: 'text', value: n.value });
          break;

        case 'strong':
          saida.push({ type: 'strong', children: inline(n.children) });
          break;
        case 'emphasis':
          saida.push({ type: 'emphasis', children: inline(n.children) });
          break;
        case 'strike':
          saida.push({ type: 'strike', children: inline(n.children) });
          break;

        case 'code-inline':
          saida.push({ type: 'code', children: [{ type: 'text', value: n.value }] });
          break;

        case 'math-inline':
          saida.push({
            type: 'math',
            display: false,
            language: n.language,
            value: n.value,
          });
          break;

        case 'link':
          saida.push({ type: 'link', url: n.url, children: inline(n.children) });
          break;

        case 'inline-container':
          saida.push(...inline(n.children));
          break;

        case 'soft-break':
          saida.push({ type: 'text', value: ' ' });
          break;
        case 'hard-break':
          saida.push({ type: 'text', value: '\n' });
          break;

        case 'citation': {
          const r = motor.formatar(n, contextoDeCitacao);
          saida.push(...r.conteudo);
          if (r.diagnosticos !== undefined) diagnosticos.push(...r.diagnosticos);
          break;
        }

        case 'note-reference':
          saida.push({
            type: 'note-mark',
            marker: marcadorDeNota(n.noteId),
            noteId: n.noteId,
          });
          break;

        case 'cross-reference': {
          const text = annotations.getString(n.id, TEXTO_DA_REFERENCIA_CRUZADA);
          const fallback = n.target.kind === 'identifier' ? n.target.identifier : String(n.target.nodeId);
          saida.push({ type: 'text', value: text ?? `[?${fallback}]` });
          break;
        }
      }
    }

    return saida;
  }

  function legenda(
    tipo: TipoDeLegenda,
    numero: string | undefined,
    cap: Caption | undefined,
  ): PublicationCaption | undefined {
    if (cap?.short === undefined && numero === undefined) return undefined;
    const texto = inline(cap?.short ?? []);

    if (profile.formatarLegenda !== undefined) {
      const r = profile.formatarLegenda(tipo, numero, texto);
      return { style: t.legenda, text: r.conteudo, position: r.position };
    }

    const rotulo = numero !== undefined ? `${ROTULO_PADRAO[tipo]} ${numero}` : '';
    const separador = rotulo !== '' && texto.length > 0 ? ' — ' : '';
    return {
      style: t.legenda,
      text: [{ type: 'text', value: `${rotulo}${separador}` }, ...texto],
      position: 'above',
    };
  }

  /**
   * Indicação de fonte de figura/tabela/citação.
   *
   * Recebe o id do nó dono para que os diagnósticos do motor de citação
   * apontem para o elemento certo — a `Attribution` não é um nó e não tem id
   * próprio.
   */
  function fonte(
    attr: Attribution | undefined,
    dono: import('@abnt/document-model').NodeId,
  ): PublicationCaption | undefined {
    if (attr === undefined) return undefined;
    const partes: PublicationInline[] = [{ type: 'text', value: 'Fonte: ' }];

    if (attr.content !== undefined) partes.push(...inline(attr.content));

    if (attr.citations !== undefined && attr.citations.length > 0) {
      const r = motor.formatar(
        { id: dono, type: 'citation', mode: 'parenthetical', items: attr.citations },
        contextoDeCitacao,
      );
      partes.push(...r.conteudo);
      if (r.diagnosticos !== undefined) diagnosticos.push(...r.diagnosticos);
    }

    return { style: t.fonte, text: partes, position: 'below' };
  }

  function linhas(rows: readonly import('@abnt/document-model').TableRow[], header: boolean): PublicationTableRow[] {
    return rows.map((linha) => ({
      cells: linha.cells.map((c) => ({
        children: blocos(c.children),
        header,
        ...(c.alignment !== undefined ? { alignment: c.alignment } : {}),
        ...(c.rowSpan !== undefined ? { rowSpan: c.rowSpan } : {}),
        ...(c.columnSpan !== undefined ? { columnSpan: c.columnSpan } : {}),
      })),
    }));
  }

  function numeroDe(no: { readonly id: import('@abnt/document-model').NodeId }, tipo: TipoDeLegenda) {
    return annotations.getString(no.id, ANOTACAO_POR_TIPO[tipo]);
  }

  function blocos(nodes: readonly BlockNode[], nivel = 1): PublicationBlock[] {
    const saida: PublicationBlock[] = [];

    for (const n of nodes) {
      switch (n.type) {
        case 'paragraph':
          saida.push({ type: 'paragraph', style: t.paragrafo, children: inline(n.children) });
          break;

        case 'section': {
          const numero = annotations.getString(n.id, NUMERO_DA_SECAO);
          saida.push({
            type: 'heading',
            level: nivel,
            style: profile.estiloDeTitulo(nivel),
            anchor: String(n.id),
            ...(numero !== undefined && profile.mostrarNumerosDeSecao !== false
              ? { number: numero }
              : {}),
            children: inline(n.title ?? []),
          });
          saida.push(...blocos(n.children, nivel + 1));
          break;
        }

        case 'heading':
          saida.push({
            type: 'heading',
            level: n.depth,
            style: profile.estiloDeTitulo(n.depth),
            anchor: String(n.id),
            children: inline(n.children),
          });
          break;

        case 'quote': {
          const attr = fonte(n.attribution, n.id);
          saida.push({
            type: 'quote',
            style: t.citacaoEmBloco,
            children: blocos(n.children, nivel),
            ...(attr !== undefined ? { attribution: attr.text } : {}),
          });
          break;
        }

        case 'list':
          saida.push({
            type: 'list',
            style: t.lista,
            ordered: n.ordered,
            ...(n.start !== undefined ? { start: n.start } : {}),
            items: n.items.map((item) => ({
              type: 'list-item' as const,
              style: t.itemDeLista,
              children: blocos(item.children, nivel),
            })),
          });
          break;

        case 'list-item':
          // Item solto fora de lista: preserva o conteúdo em vez de descartar.
          saida.push(...blocos(n.children, nivel));
          break;

        case 'figure': {
          const primeira = n.content[0];
          const recurso =
            primeira !== undefined ? resources[primeira.resourceId] : undefined;

          if (recurso === undefined) {
            diagnosticos.push({
              id: 'RECURSO-AUSENTE',
              severity: 'error',
              message: 'Figura sem recurso associado; nada a renderizar.',
              nodeId: n.id,
              ...(n.source !== undefined ? { source: n.source } : {}),
            });
            break;
          }

          const cap = legenda('figure', numeroDe(n, 'figure'), n.caption);
          const src = fonte(n.attribution, n.id);
          saida.push({
            type: 'figure',
            style: t.figura,
            anchor: String(n.id),
            src: recurso.uri,
            alt:
              primeira !== undefined && primeira.type === 'image'
                ? textoPuro(primeira.alt)
                : '',
            ...(cap !== undefined ? { caption: cap } : {}),
            ...(src !== undefined ? { attribution: src } : {}),
          });
          break;
        }

        case 'table': {
          const cap = legenda('table', numeroDe(n, 'table'), n.caption);
          const src = fonte(n.attribution, n.id);
          saida.push({
            type: 'table',
            style: t.tabela,
            anchor: String(n.id),
            head: linhas(n.head ?? [], true),
            body: linhas(n.body, false),
            ...(cap !== undefined ? { caption: cap } : {}),
            ...(src !== undefined ? { attribution: src } : {}),
          });
          break;
        }

        case 'code-block': {
          const cap = legenda('code', numeroDe(n, 'code'), n.caption);
          saida.push({
            type: 'code',
            style: t.codigo,
            anchor: String(n.id),
            ...(n.language !== undefined ? { language: n.language } : {}),
            value: n.value,
            ...(cap !== undefined ? { caption: cap } : {}),
          });
          break;
        }

        case 'math-block': {
          const cap = legenda('equation', numeroDe(n, 'equation'), n.caption);
          saida.push({
            type: 'math-block',
            style: t.equacao,
            anchor: String(n.id),
            language: n.language,
            value: n.value,
            ...(cap !== undefined ? { caption: cap } : {}),
          });
          break;
        }

        case 'thematic-break':
          saida.push({ type: 'thematic-break', style: t.separador });
          break;

        case 'container':
          saida.push(...blocos(n.children, nivel));
          break;
      }
    }

    return saida;
  }

  const utils = { inline, blocos: (n: readonly BlockNode[]) => blocos(n) };
  const corpo: PublicationBlock[] = [
    ...profile.frontMatter(doc, utils),
    ...blocos(ast.document.children, 1),
    ...(profile.backMatter?.(doc, utils) ?? []),
  ];

  // Notas depois do corpo: a numeração depende de já termos percorrido o texto.
  const notas: PublicationNote[] = ordemDasNotas.map((noteId, i) => {
    const nota = ast.notes[noteId];
    return {
      id: noteId,
      marker: profile.marcadorDeNota?.(i + 1) ?? String(i + 1),
      kind: nota?.kind ?? 'footnote',
      style: t.nota,
      children: nota !== undefined ? blocos(nota.children) : [],
    };
  });

  const titulo: RichText | undefined = ast.document.metadata.title;

  return {
    documento: {
      schema: 'publication-ast',
      version: 1,
      title: textoPuro(titulo) || 'Sem título',
      language: ast.document.metadata.languages?.[0] ?? 'pt-BR',
      page: profile.page,
      styles: profile.styles,
      children: corpo,
      notes: notas,
    },
    diagnosticos,
  };
}

export type { DocumentAst };
