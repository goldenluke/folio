/** Gera Markdown autoral para os comandos de escrita; nenhuma UI interpreta AST. */
export const figureSource = (input: { readonly uri: string; readonly alt: string; readonly caption: string; readonly source?: string; readonly identifier?: string }): string => {
  const id = input.identifier?.trim();
  return [
    input.caption.trim() === '' ? '' : `Figura: ${input.caption.trim()}`,
    `![${input.alt.trim()}](${input.uri})${id === undefined || id === '' ? '' : ` {#${id}}`}`,
    input.source?.trim() === '' || input.source === undefined ? '' : `Fonte: ${input.source.trim()}`,
  ].filter(Boolean).join('\n');
};

export const tableSource = (columns: number, rows: number, alignment: 'left' | 'center' | 'right' = 'left'): string => {
  const width = Math.max(1, Math.min(12, Math.floor(columns)));
  const height = Math.max(1, Math.min(100, Math.floor(rows)));
  const header = Array.from({ length: width }, (_, index) => ` Coluna ${index + 1} `).join('|');
  const marker = alignment === 'center' ? ' :---: ' : alignment === 'right' ? ' ---: ' : ' --- ';
  const divider = Array.from({ length: width }, () => marker).join('|');
  const body = Array.from({ length: height }, () => `|${Array.from({ length: width }, () => ' ').join('|')}|`).join('\n');
  return `|${header}|\n|${divider}|\n${body}`;
};

/**
 * Representação textual de uma tabela GFM. Ela existe para a UI de autoria,
 * não para substituir o parser do documento: a tabela que sai daqui continua
 * sendo Markdown comum e é validada/compilada pelo pipeline normal.
 */
export interface MarkdownTableDraft {
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
  readonly alignment: readonly ('left' | 'center' | 'right')[];
}

const cells = (line: string): string[] => line.trim().replace(/^\||\|$/gu, '').split('|').map((cell) => cell.trim());
const alignmentOf = (cell: string): 'left' | 'center' | 'right' => /^:\s*-+\s*:\s*$/u.test(cell) ? 'center' : /-+\s*:\s*$/u.test(cell) ? 'right' : 'left';

export const parseMarkdownTable = (source: string): MarkdownTableDraft | undefined => {
  const lines = source.trim().split('\n');
  if (lines.length < 2 || !/^\s*\|/u.test(lines[0] ?? '') || !/^\s*\|/u.test(lines[1] ?? '')) return undefined;
  const headers = cells(lines[0]!);
  const markers = cells(lines[1]!);
  if (headers.length === 0 || markers.length !== headers.length || markers.some((marker) => !/^\s*:?-{3,}:?\s*$/u.test(marker))) return undefined;
  const rows = lines.slice(2).filter((line) => /^\s*\|/u.test(line)).map((line) => {
    const row = cells(line); return headers.map((_, index) => row[index] ?? '');
  });
  return { headers, rows, alignment: markers.map(alignmentOf) };
};

export const markdownTableSource = (draft: MarkdownTableDraft): string => {
  const width = Math.max(1, Math.min(12, draft.headers.length));
  const headers = Array.from({ length: width }, (_, index) => draft.headers[index]?.trim() || `Coluna ${index + 1}`);
  const marker = (alignment: 'left' | 'center' | 'right'): string => alignment === 'center' ? ':---:' : alignment === 'right' ? '---:' : '---';
  const line = (values: readonly string[]): string => `| ${headers.map((_, index) => values[index]?.trim() ?? '').join(' | ')} |`;
  return [line(headers), `| ${headers.map((_, index) => marker(draft.alignment[index] ?? 'left')).join(' | ')} |`, ...draft.rows.map(line)].join('\n');
};

export const equationSource = (tex: string, identifier?: string): string => {
  const id = identifier?.trim();
  return [`$$\n${tex.trim() || 'x = y'}\n$$`, id === undefined || id === '' ? '' : `{#${id}}`].filter(Boolean).join('\n');
};

export type TemplateKind = 'article' | 'reading-note' | 'research-project' | 'tcc' | 'dissertation' | 'thesis' | 'abstract' | 'institutional-article' | 'institutional-tcc';

export interface AuthoredTemplateFile {
  readonly path: string;
  readonly content: string;
}

/** F62: módulos continuam Markdown normal; só a raiz declara a composição. */
export const modularTccTemplate = (directory: string): readonly AuthoredTemplateFile[] => {
  const base = directory.replace(/\/+$/u, '') || 'tcc';
  return [
    {
      path: `${base}/index.md`,
      content: `---\ntitle: Título do TCC\nauthors:\n  - Nome da autora ou autor\ninstitution: Instituição\ncourse: Curso\ncity: Cidade\nyear: 2026\nprofile: abnt-tcc\n---\n\n![[chapters/01-introducao.md]]\n\n![[chapters/02-fundamentacao.md]]\n\n![[chapters/03-metodologia.md]]\n\n![[chapters/04-resultados.md]]\n\n![[chapters/05-conclusao.md]]\n\n# Referências\n`,
    },
    { path: `${base}/chapters/01-introducao.md`, content: '# Introdução\n\n' },
    { path: `${base}/chapters/02-fundamentacao.md`, content: '# Fundamentação teórica\n\n' },
    { path: `${base}/chapters/03-metodologia.md`, content: '# Metodologia\n\n' },
    { path: `${base}/chapters/04-resultados.md`, content: '# Resultados e discussão\n\n' },
    { path: `${base}/chapters/05-conclusao.md`, content: '# Considerações finais\n\n' },
  ];
};

export const templateSource = (kind: TemplateKind): string => {
  switch (kind) {
    case 'institutional-article': return `---\ntitle: Título do artigo\nauthors:\n  - Nome da autora ou autor\nproperties:\n  tcc:institution: Instituição\n  tcc:course: Programa ou curso\n  tcc:place: Cidade\n  tcc:year: 2026\nprofile: abnt-artigo\n---\n\n# Introdução\n\n# Desenvolvimento\n\n# Considerações finais\n\n# Referências\n`;
    case 'institutional-tcc': return `---\ntitle: Título do trabalho\nauthors:\n  - Nome da autora ou autor\ncontributors:\n  - name: Nome da orientação\n    role: advisor\nproperties:\n  tcc:institution: Instituição\n  tcc:course: Curso\n  tcc:place: Cidade\n  tcc:year: 2026\nprofile: institutional-tcc\n---\n\n# Introdução\n\n# Fundamentação teórica\n\n# Metodologia\n\n# Resultados e discussão\n\n# Considerações finais\n\n# Referências\n`;
    case 'abstract': return `---\ntitle: Resumo\nkeywords:\n  - palavra-chave\n---\n\n# Resumo\n\n# Palavras-chave\n`;
    case 'tcc': return `---\ntitle: Título do TCC\nauthors:\n  - Nome da autora ou autor\ninstitution: Instituição\ncourse: Curso\ncity: Cidade\nyear: 2026\nprofile: abnt-tcc\n---\n\n# Introdução\n\n# Fundamentação teórica\n\n# Metodologia\n\n# Resultados e discussão\n\n# Considerações finais\n\n# Referências\n`;
    case 'dissertation': return `---\ntitle: Título da dissertação\nauthors:\n  - Nome da autora ou autor\ninstitution: Instituição\ncity: Cidade\nyear: 2026\nprofile: abnt-tcc\n---\n\n# Introdução\n\n# Referencial teórico\n\n# Metodologia\n\n# Análise\n\n# Conclusão\n\n# Referências\n`;
    case 'thesis': return `---\ntitle: Título da tese\nauthors:\n  - Nome da autora ou autor\ninstitution: Instituição\ncity: Cidade\nyear: 2026\nprofile: abnt-tcc\n---\n\n# Introdução\n\n# Fundamentação teórica\n\n# Método\n\n# Resultados\n\n# Discussão\n\n# Conclusão\n\n# Referências\n`;
    case 'reading-note': return `---\ntitle: Fichamento\n---\n\n# Referência\n\n# Ideias centrais\n\n# Citações\n\n# Comentários\n`;
    case 'research-project': return `---\ntitle: Projeto de pesquisa\n---\n\n# Problema\n\n# Objetivos\n\n# Metodologia\n\n# Cronograma\n\n# Referências\n`;
    default: return `---\ntitle: Título do artigo\nauthors:\n  - Nome da autora ou autor\nkeywords:\n  - palavra-chave\nprofile: abnt-article\n---\n\n# Introdução\n\n# Desenvolvimento\n\n# Considerações finais\n\n# Referências\n`;
  }
};
