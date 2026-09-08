import { parseMarkdown } from '@abnt/markdown';
import { percorrer, type DocumentAst, type InlineNode } from '@abnt/document-model';

/**
 * F70 — fatos editoriais entre duas revisões de um documento, não um diff de
 * árvore serializada (item 16 do roadmap da Onda O). Cada fato é algo que um
 * autor reconheceria: "Seção X renomeada", nunca "node n46 changed children[]".
 * Complementa o diff por linha (F64); não o substitui — ver ADR 0053/0055.
 */
export type StructuralChangeKind =
  | 'section-added'
  | 'section-removed'
  | 'section-renamed'
  | 'citation-added'
  | 'citation-removed'
  | 'figure-added'
  | 'figure-removed'
  | 'table-added'
  | 'table-removed'
  | 'reference-target-changed'
  | 'metadata-changed';

export interface StructuralChange {
  readonly kind: StructuralChangeKind;
  /** Linguagem editorial, pt-BR, pronta para exibir — nunca um dump de AST. */
  readonly description: string;
}

const textOf = (nodes: readonly InlineNode[] | undefined): string => {
  if (nodes === undefined) return '';
  return nodes
    .map((node): string => {
      switch (node.type) {
        case 'text':
        case 'code-inline':
        case 'math-inline':
          return node.value;
        case 'soft-break':
        case 'hard-break':
          return ' ';
        case 'citation':
        case 'cross-reference':
        case 'note-reference':
          return '';
        case 'emphasis':
        case 'strong':
        case 'strike':
        case 'link':
        case 'inline-container':
          return textOf(node.children);
      }
    })
    .join('')
    .replace(/\s+/gu, ' ')
    .trim();
};

interface Keyed<T> {
  readonly key: string;
  readonly value: T;
}

/**
 * Casa duas listas por chave estável. Sem chave em comum não há "renomeado" —
 * só a diferença honesta: um item some, outro aparece. Item 12 do roadmap
 * (não inventar origem) vale aqui tanto quanto para diagnósticos.
 */
const diffByKey = <T>(
  from: readonly Keyed<T>[],
  to: readonly Keyed<T>[],
): { readonly added: readonly T[]; readonly removed: readonly T[]; readonly matched: readonly (readonly [T, T])[] } => {
  const fromByKey = new Map(from.map((item) => [item.key, item.value] as const));
  const toByKey = new Map(to.map((item) => [item.key, item.value] as const));
  const added = to.filter((item) => !fromByKey.has(item.key)).map((item) => item.value);
  const removed = from.filter((item) => !toByKey.has(item.key)).map((item) => item.value);
  const matched: (readonly [T, T])[] = [];
  for (const [key, fromValue] of fromByKey) {
    const toValue = toByKey.get(key);
    if (toValue !== undefined) matched.push([fromValue, toValue]);
  }
  return { added, removed, matched };
};

interface SectionFact { readonly identifier?: string; readonly title: string; }
interface FigureOrTableFact { readonly identifier?: string; readonly label: string; }
interface LinkFact { readonly label: string; readonly url: string; }

const sectionsOf = (ast: DocumentAst): readonly SectionFact[] =>
  [...percorrer(ast)].flatMap((node) =>
    node.type === 'section' ? [{ ...(node.attributes?.identifier !== undefined ? { identifier: node.attributes.identifier } : {}), title: textOf(node.title) || '(sem título)' }] : [],
  );

const citationIdsOf = (ast: DocumentAst): readonly string[] =>
  [...percorrer(ast)].flatMap((node) => (node.type === 'citation' ? node.items.map((item) => String(item.referenceId)) : []));

const figuresOf = (ast: DocumentAst): readonly FigureOrTableFact[] =>
  [...percorrer(ast)].flatMap((node) => {
    if (node.type !== 'figure') return [];
    const label = textOf(node.caption?.short) || node.attributes?.identifier || '(sem legenda)';
    return [{ ...(node.attributes?.identifier !== undefined ? { identifier: node.attributes.identifier } : {}), label }];
  });

const tablesOf = (ast: DocumentAst): readonly FigureOrTableFact[] =>
  [...percorrer(ast)].flatMap((node) => {
    if (node.type !== 'table') return [];
    const label = textOf(node.caption?.short) || node.attributes?.identifier || '(sem legenda)';
    return [{ ...(node.attributes?.identifier !== undefined ? { identifier: node.attributes.identifier } : {}), label }];
  });

const linksOf = (ast: DocumentAst): readonly LinkFact[] =>
  [...percorrer(ast)].flatMap((node) => {
    if (node.type !== 'link') return [];
    const label = textOf(node.children);
    return label === '' ? [] : [{ label, url: node.url }];
  });

const sectionFacts = (sections: readonly SectionFact[]): { readonly identified: readonly Keyed<SectionFact>[]; readonly anonymous: readonly Keyed<SectionFact>[] } => ({
  identified: sections.filter((section) => section.identifier !== undefined).map((section) => ({ key: section.identifier as string, value: section })),
  anonymous: sections.filter((section) => section.identifier === undefined).map((section) => ({ key: section.title, value: section })),
});

const figureFacts = (items: readonly FigureOrTableFact[]): { readonly identified: readonly Keyed<FigureOrTableFact>[]; readonly anonymous: readonly Keyed<FigureOrTableFact>[] } => ({
  identified: items.filter((item) => item.identifier !== undefined).map((item) => ({ key: item.identifier as string, value: item })),
  anonymous: items.filter((item) => item.identifier === undefined).map((item) => ({ key: item.label, value: item })),
});

/**
 * Compara duas revisões de UM documento (mesmo `fileId`, conteúdo antes/depois
 * — não a fonte composta de F60–F62). Parseia as duas de forma independente:
 * não reaproveita sessão nem ambiente, então nunca vê citação/figura resolvida
 * contra bibliografia — só a estrutura que o próprio Markdown já expressa.
 */
export function structuralDiff(from: string, to: string): readonly StructuralChange[] {
  const fromAst = parseMarkdown(from);
  const toAst = parseMarkdown(to);
  const changes: StructuralChange[] = [];

  const fromSections = sectionFacts(sectionsOf(fromAst));
  const toSections = sectionFacts(sectionsOf(toAst));
  const identifiedSections = diffByKey(fromSections.identified, toSections.identified);
  for (const [before, after] of identifiedSections.matched) {
    if (before.title !== after.title) {
      changes.push({ kind: 'section-renamed', description: `Seção "${before.title}" renomeada para "${after.title}".` });
    }
  }
  const anonymousSections = diffByKey(fromSections.anonymous, toSections.anonymous);
  for (const section of [...identifiedSections.added, ...anonymousSections.added]) {
    changes.push({ kind: 'section-added', description: `Seção "${section.title}" adicionada.` });
  }
  for (const section of [...identifiedSections.removed, ...anonymousSections.removed]) {
    changes.push({ kind: 'section-removed', description: `Seção "${section.title}" removida.` });
  }

  const citationChanges = diffByKey(
    citationIdsOf(fromAst).map((id) => ({ key: id, value: id })),
    citationIdsOf(toAst).map((id) => ({ key: id, value: id })),
  );
  for (const id of citationChanges.added) changes.push({ kind: 'citation-added', description: `Citação "${id}" adicionada.` });
  for (const id of citationChanges.removed) changes.push({ kind: 'citation-removed', description: `Citação "${id}" removida.` });

  const fromFigures = figureFacts(figuresOf(fromAst));
  const toFigures = figureFacts(figuresOf(toAst));
  const figureChanges = diffByKey(fromFigures.identified, toFigures.identified);
  const anonymousFigureChanges = diffByKey(fromFigures.anonymous, toFigures.anonymous);
  for (const figure of [...figureChanges.added, ...anonymousFigureChanges.added]) changes.push({ kind: 'figure-added', description: `Figura "${figure.label}" adicionada.` });
  for (const figure of [...figureChanges.removed, ...anonymousFigureChanges.removed]) changes.push({ kind: 'figure-removed', description: `Figura "${figure.label}" removida.` });

  const fromTables = figureFacts(tablesOf(fromAst));
  const toTables = figureFacts(tablesOf(toAst));
  const tableChanges = diffByKey(fromTables.identified, toTables.identified);
  const anonymousTableChanges = diffByKey(fromTables.anonymous, toTables.anonymous);
  for (const table of [...tableChanges.added, ...anonymousTableChanges.added]) changes.push({ kind: 'table-added', description: `Tabela "${table.label}" adicionada.` });
  for (const table of [...tableChanges.removed, ...anonymousTableChanges.removed]) changes.push({ kind: 'table-removed', description: `Tabela "${table.label}" removida.` });

  const linkChanges = diffByKey(
    linksOf(fromAst).map((link) => ({ key: link.label, value: link })),
    linksOf(toAst).map((link) => ({ key: link.label, value: link })),
  );
  for (const [before, after] of linkChanges.matched) {
    if (before.url !== after.url) {
      changes.push({ kind: 'reference-target-changed', description: `Link "${before.label}" agora aponta para "${after.url}" (era "${before.url}").` });
    }
  }

  const fromTitle = textOf(fromAst.document.metadata.title);
  const toTitle = textOf(toAst.document.metadata.title);
  if (fromTitle !== toTitle) changes.push({ kind: 'metadata-changed', description: `Título alterado de "${fromTitle}" para "${toTitle}".` });
  const fromSubtitle = textOf(fromAst.document.metadata.subtitle);
  const toSubtitle = textOf(toAst.document.metadata.subtitle);
  if (fromSubtitle !== toSubtitle) changes.push({ kind: 'metadata-changed', description: `Subtítulo alterado de "${fromSubtitle}" para "${toSubtitle}".` });

  return changes;
}
