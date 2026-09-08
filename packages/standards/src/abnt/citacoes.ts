import {
  anoDaReferencia,
  autorDaChamada,
  autorDaChamadaParentetica,
  compararReferencias,
} from '@abnt/bibliography';
import type {
  BibliographicEntity,
  CitationItem,
  CitationNode,
  InlineNode,
} from '@abnt/document-model';
import type {
  ContextoDeCitacao,
  MotorDeCitacao,
  PublicationInline,
  ResultadoDeCitacao,
} from '@abnt/publication';

function textoInline(nodes: readonly InlineNode[] | undefined): string {
  if (nodes === undefined) return '';
  let text = '';
  for (const node of nodes) {
    switch (node.type) {
      case 'text':
      case 'code-inline':
      case 'math-inline':
        text += node.value;
        break;
      case 'soft-break':
        text += ' ';
        break;
      case 'hard-break':
        text += '\n';
        break;
      case 'emphasis':
      case 'strong':
      case 'strike':
      case 'link':
      case 'inline-container':
        text += textoInline(node.children);
        break;
      case 'citation':
      case 'cross-reference':
      case 'note-reference':
        break;
    }
  }
  return text.trim();
}

function localizador(item: CitationItem): string {
  if (item.locator === undefined) return '';
  const labels: Readonly<Record<string, string>> = {
    page: 'p.',
    'page-range': 'p.',
    chapter: 'cap.',
    section: 'seção',
    paragraph: '§',
    volume: 'v.',
    issue: 'n.',
    figure: 'fig.',
    table: 'tab.',
    note: 'nota',
    timestamp: '',
  };
  const label = labels[item.locator.type] ?? item.locator.type.replace(/^custom:/, '');
  return label === '' ? item.locator.value : `${label} ${item.locator.value}`;
}

function decoracoes(item: CitationItem, core: string): string {
  const prefix = textoInline(item.prefix);
  const suffix = textoInline(item.suffix);
  return `${prefix !== '' ? `${prefix} ` : ''}${core}${suffix !== '' ? `, ${suffix}` : ''}`;
}

function itemAutorData(
  citation: CitationNode,
  item: CitationItem,
  entry: BibliographicEntity | undefined,
  context: ContextoDeCitacao,
): string {
  if (entry === undefined) return `[?${item.referenceId}]`;
  const author =
    citation.mode === 'parenthetical'
      ? autorDaChamadaParentetica(entry)
      : autorDaChamada(entry);
  const year = `${anoDaReferencia(entry)}${context.yearSuffixByReference.get(item.referenceId) ?? ''}`;
  const locator = localizador(item);

  if (citation.mode === 'author-only') return decoracoes(item, author);
  if (citation.mode === 'year-only') return decoracoes(item, year);

  if (citation.mode === 'narrative') {
    const inside = [year, locator].filter(Boolean).join(', ');
    return decoracoes(item, item.suppressAuthor === true ? `(${inside})` : `${author} (${inside})`);
  }

  const core = [item.suppressAuthor === true ? undefined : author, year, locator]
    .filter((part): part is string => part !== undefined && part !== '')
    .join(', ');
  return decoracoes(item, core);
}

function itemsAutorData(citation: CitationNode, context: ContextoDeCitacao): readonly CitationItem[] {
  if (citation.mode !== 'parenthetical' || citation.items.length < 2) return citation.items;
  return [...citation.items].sort((a, b) => {
    const entryA = context.references[a.referenceId];
    const entryB = context.references[b.referenceId];
    if (entryA === undefined) return entryB === undefined ? a.referenceId.localeCompare(b.referenceId) : 1;
    if (entryB === undefined) return -1;
    return compararReferencias(entryA, entryB);
  });
}

export const motorAutorDataAbnt: MotorDeCitacao = {
  id: 'abnt:nbr-10520@2023/autor-data',
  formatar(citation, context): ResultadoDeCitacao {
    const values = itemsAutorData(citation, context).map((item) =>
      itemAutorData(citation, item, context.references[item.referenceId], context),
    );
    const joined = values.join('; ');
    const value = citation.mode === 'parenthetical' ? `(${joined})` : joined;
    return { conteudo: [{ type: 'text', value }] };
  },
};

function itemNumerico(item: CitationItem, context: ContextoDeCitacao): string {
  const number = context.numberByReference.get(item.referenceId);
  const base = number !== undefined ? String(number) : `?${item.referenceId}`;
  const locator = localizador(item);
  return decoracoes(item, [base, locator].filter(Boolean).join(', '));
}

export const motorNumericoAbnt: MotorDeCitacao = {
  id: 'abnt:nbr-10520@2023/numerico',
  formatar(citation, context): ResultadoDeCitacao {
    if (citation.mode === 'author-only' || citation.mode === 'year-only') {
      const values = citation.items.map((item) => {
        const entry = context.references[item.referenceId];
        if (entry === undefined) return `[?${item.referenceId}]`;
        const value =
          citation.mode === 'author-only' ? autorDaChamada(entry) : anoDaReferencia(entry);
        return decoracoes(item, value);
      });
      return { conteudo: [{ type: 'text', value: values.join('; ') }] };
    }

    if (citation.mode === 'narrative') {
      const values = citation.items.map((item) => {
        const call = itemNumerico(item, context);
        const entry = context.references[item.referenceId];
        if (entry === undefined || item.suppressAuthor === true) return `(${call})`;
        return `${autorDaChamada(entry)} (${call})`;
      });
      return { conteudo: [{ type: 'text', value: values.join('; ') }] };
    }

    const values = citation.items.map((item) => itemNumerico(item, context));
    const separator = citation.items.some((item) => item.locator !== undefined) ? '; ' : ', ';
    return { conteudo: [{ type: 'text', value: `(${values.join(separator)})` }] };
  },
  validarDocumento(doc) {
    if (Object.keys(doc.ast.notes).length === 0 || doc.citations.citedReferenceIds.length === 0) {
      return [];
    }
    return [
      {
        id: 'ABNT-10520-NUM-001',
        severity: 'error',
        message: 'O sistema de chamada numérico não pode ser combinado com notas no documento.',
      },
    ];
  },
};

export function textoDaCitacao(conteudo: readonly PublicationInline[]): string {
  return conteudo.map((item) => (item.type === 'text' ? item.value : '')).join('');
}
