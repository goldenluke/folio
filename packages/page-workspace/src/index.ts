import { extrairFrontmatter } from '@abnt/markdown';
import { stringify as stringifyYaml } from 'yaml';

export const PAGE_TYPES = ['document', 'note', 'project', 'dataset', 'evidence'] as const;
export type PageType = (typeof PAGE_TYPES)[number];

export interface FolioPageRelation {
  readonly targetId: string;
  readonly kind: string;
}

/** Metadados autorais de uma página. Campos desconhecidos nunca são apagados. */
export interface FolioPageProperties {
  readonly id?: string;
  readonly type?: PageType;
  readonly status?: string;
  readonly tags: readonly string[];
  readonly aliases: readonly string[];
  readonly due?: string;
  readonly project?: string;
  readonly relations: readonly FolioPageRelation[];
}

export interface PageDiagnostic {
  readonly field: string;
  readonly message: string;
}

export interface PageTask {
  readonly text: string;
  readonly completed: boolean;
  readonly line: number;
  readonly offset: number;
  readonly due?: string;
  readonly status?: string;
  readonly project?: string;
}

export interface PageRecord {
  readonly fileId: string;
  readonly path: string;
  readonly title: string;
  readonly body: string;
  readonly properties: FolioPageProperties;
  readonly tasks: readonly PageTask[];
  readonly diagnostics: readonly PageDiagnostic[];
}

export interface PageDocumentInput {
  readonly fileId: string;
  readonly path: string;
  readonly source: string;
}

export type PageField = 'title' | 'type' | 'status' | 'tags' | 'due' | 'project';
export interface PageFilter {
  readonly field: PageField;
  readonly value: string;
}
export interface PageSort {
  readonly field: PageField;
  readonly direction?: 'ascending' | 'descending';
}
export interface PageGroup {
  readonly value: string;
  readonly pages: readonly PageRecord[];
}
export interface PageGraphEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: 'wikilink' | 'declared-relation';
}

export const HOME_BLOCK_KINDS = ['recent', 'favorites', 'documents', 'tasks', 'projects', 'bases', 'captures', 'calendar', 'graph', 'shortcuts'] as const;
export type HomeBlockKind = (typeof HOME_BLOCK_KINDS)[number];
export interface HomeBlock {
  readonly id: string;
  readonly kind: HomeBlockKind;
  readonly title: string;
  readonly span: 1 | 2 | 3;
  readonly enabled: boolean;
}
export interface WorkspacePanelLayout { readonly explorerWidth: number; readonly contextWidth: number; }
export interface WorkspaceHomeLayout { readonly version: 1; readonly blocks: readonly HomeBlock[]; readonly panels: WorkspacePanelLayout; }
export interface WorkspaceTheme { readonly version: 1; readonly id: string; readonly name: string; readonly mode: 'light' | 'dark'; readonly tokens: Readonly<Record<string, string>>; }
export interface WorkspaceThemes { readonly version: 1; readonly activeId: string; readonly themes: readonly WorkspaceTheme[]; }
const THEME_TOKEN = /^(accent|accentStrong|surface|surfaceMuted|text|textMuted|border|fontSans|fontSerif|radius|spacing)$/u;
const CSS_VALUE = /^[#(),.%\w\s"'-]{1,120}$/u;
export function defaultWorkspaceThemes(): WorkspaceThemes { return { version: 1, activeId: 'folio-light', themes: [{ version: 1, id: 'folio-light', name: 'Folio claro', mode: 'light', tokens: { accent: '#4f46e5', accentStrong: '#3730a3', surface: '#ffffff', surfaceMuted: '#f8fafc', text: '#0f172a', textMuted: '#64748b', border: '#e2e8f0', fontSans: 'Inter, sans-serif', fontSerif: 'Georgia, serif', radius: '0.75rem', spacing: '1rem' } }, { version: 1, id: 'folio-dark', name: 'Folio escuro', mode: 'dark', tokens: { accent: '#818cf8', accentStrong: '#a5b4fc', surface: '#0f172a', surfaceMuted: '#1e293b', text: '#f8fafc', textMuted: '#cbd5e1', border: '#334155', fontSans: 'Inter, sans-serif', fontSerif: 'Georgia, serif', radius: '0.75rem', spacing: '1rem' } }] }; }
export function createWorkspaceThemes(input: WorkspaceThemes): WorkspaceThemes { if (input.version !== 1 || !Array.isArray(input.themes)) throw new Error('Tema de workspace inválido.'); const ids = new Set<string>(); const themes = input.themes.map((theme) => { const id = theme.id.trim(); const name = theme.name.trim(); if (id === '' || name === '' || ids.has(id) || (theme.mode !== 'light' && theme.mode !== 'dark')) throw new Error('Tema de workspace inválido.'); for (const [key, value] of Object.entries(theme.tokens)) if (typeof value !== 'string' || !THEME_TOKEN.test(key) || !CSS_VALUE.test(value)) throw new Error(`Token de tema inválido: ${key}.`); ids.add(id); return { ...theme, id, name, tokens: { ...theme.tokens } }; }); if (!ids.has(input.activeId)) throw new Error('O tema ativo precisa existir.'); return { version: 1, activeId: input.activeId, themes }; }

const HOME_BLOCK_DEFAULTS: Readonly<Record<HomeBlockKind, Omit<HomeBlock, 'id'>>> = {
  recent: { kind: 'recent', title: 'Recentes', span: 2, enabled: true },
  favorites: { kind: 'favorites', title: 'Favoritos', span: 1, enabled: true },
  documents: { kind: 'documents', title: 'Documentos', span: 2, enabled: true },
  tasks: { kind: 'tasks', title: 'Tarefas', span: 1, enabled: true },
  projects: { kind: 'projects', title: 'Projetos', span: 1, enabled: true },
  bases: { kind: 'bases', title: 'Bases acadêmicas', span: 1, enabled: true },
  captures: { kind: 'captures', title: 'Capturas', span: 1, enabled: true },
  calendar: { kind: 'calendar', title: 'Calendário', span: 1, enabled: true },
  graph: { kind: 'graph', title: 'Grafo', span: 1, enabled: true },
  shortcuts: { kind: 'shortcuts', title: 'Atalhos', span: 1, enabled: true },
};

/** Cada tipo tem um bloco padrão estável, para que o layout permaneça portável. */
export function createHomeBlock(kind: HomeBlockKind): HomeBlock { return { id: kind, ...HOME_BLOCK_DEFAULTS[kind] }; }

export function defaultWorkspaceHomeLayout(): WorkspaceHomeLayout {
  return { version: 1, panels: { explorerWidth: 288, contextWidth: 272 }, blocks: [
    createHomeBlock('recent'), createHomeBlock('tasks'), createHomeBlock('projects'),
    createHomeBlock('documents'), createHomeBlock('captures'), createHomeBlock('shortcuts'),
  ] };
}

export function createWorkspaceHomeLayout(input: WorkspaceHomeLayout): WorkspaceHomeLayout {
  if (input.version !== 1) throw new Error('Versão de layout da Home não suportada.');
  const ids = new Set<string>();
  const blocks = input.blocks.map((block) => {
    const id = block.id.trim(); const title = block.title.trim();
    if (id === '' || title === '') throw new Error('Todo bloco da Home exige identidade e título.');
    if (ids.has(id)) throw new Error('Bloco da Home duplicado.');
    if (!HOME_BLOCK_KINDS.includes(block.kind) || ![1, 2, 3].includes(block.span)) throw new Error('Bloco da Home inválido.');
    ids.add(id); return { ...block, id, title };
  });
  const panels = input.panels;
  if (!Number.isFinite(panels?.explorerWidth) || !Number.isFinite(panels.contextWidth) || panels.explorerWidth < 220 || panels.explorerWidth > 440 || panels.contextWidth < 220 || panels.contextWidth > 440) throw new Error('Largura de painel inválida.');
  return { version: 1, blocks, panels: { explorerWidth: Math.round(panels.explorerWidth), contextWidth: Math.round(panels.contextWidth) } };
}

/** Reordena blocos sem alterar a configuração original da Home. */
export function reorderHomeBlocks(layout: WorkspaceHomeLayout, fromId: string, toId: string): WorkspaceHomeLayout {
  const from = layout.blocks.findIndex((block) => block.id === fromId);
  const to = layout.blocks.findIndex((block) => block.id === toId);
  if (from < 0 || to < 0 || from === to) return layout;
  const blocks = [...layout.blocks];
  const [block] = blocks.splice(from, 1);
  blocks.splice(to, 0, block!);
  return createWorkspaceHomeLayout({ ...layout, blocks });
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TASK = /^\s*[-*+]\s+\[([ xX])\]\s+(.+?)\s*$/gm;
const WIKILINK = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;

function strings(value: unknown, field: string, diagnostics: PageDiagnostic[]): readonly string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || entry.trim() === '')) {
    diagnostics.push({ field, message: `${field} deve ser uma lista de textos não vazios.` });
    return [];
  }
  return [...new Set(value.map((entry) => entry.trim()))];
}

function text(value: unknown, field: string, diagnostics: PageDiagnostic[]): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim() === '') {
    diagnostics.push({ field, message: `${field} deve ser um texto não vazio.` });
    return undefined;
  }
  return value.trim();
}

function propertiesFrom(value: unknown, diagnostics: PageDiagnostic[]): FolioPageProperties {
  const source = value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  if (value !== undefined && source !== value) diagnostics.push({ field: 'folio', message: 'folio deve ser um mapa de propriedades.' });
  const id = text(source.id, 'folio.id', diagnostics);
  const type = text(source.type, 'folio.type', diagnostics);
  const status = text(source.status, 'folio.status', diagnostics);
  const due = text(source.due, 'folio.due', diagnostics);
  const project = text(source.project, 'folio.project', diagnostics);
  if (type !== undefined && !PAGE_TYPES.includes(type as PageType)) diagnostics.push({ field: 'folio.type', message: 'tipo de página inválido.' });
  if (due !== undefined && !DATE.test(due)) diagnostics.push({ field: 'folio.due', message: 'prazo deve usar AAAA-MM-DD.' });
  const rawRelations = source.relations;
  const relations: FolioPageRelation[] = [];
  if (rawRelations !== undefined) {
    if (!Array.isArray(rawRelations)) diagnostics.push({ field: 'folio.relations', message: 'relations deve ser uma lista.' });
    else for (const entry of rawRelations) {
      if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) { diagnostics.push({ field: 'folio.relations', message: 'relação inválida ignorada.' }); continue; }
      const relation = entry as Record<string, unknown>;
      const targetId = typeof relation.targetId === 'string' ? relation.targetId.trim() : '';
      const kind = typeof relation.kind === 'string' ? relation.kind.trim() : '';
      if (targetId === '' || kind === '') diagnostics.push({ field: 'folio.relations', message: 'relação exige targetId e kind.' });
      else relations.push({ targetId, kind });
    }
  }
  return {
    ...(id === undefined ? {} : { id }),
    ...(type !== undefined && PAGE_TYPES.includes(type as PageType) ? { type: type as PageType } : {}),
    ...(status === undefined ? {} : { status }),
    tags: strings(source.tags, 'folio.tags', diagnostics),
    aliases: strings(source.aliases, 'folio.aliases', diagnostics),
    ...(due !== undefined && DATE.test(due) ? { due } : {}),
    ...(project === undefined ? {} : { project }),
    relations,
  };
}

function titleFor(path: string, source: Record<string, unknown>): string {
  if (typeof source.title === 'string' && source.title.trim() !== '') return source.title.trim();
  const leaf = path.split('/').at(-1) ?? path;
  return leaf.replace(/\.md$/i, '') || 'Sem título';
}

function tasksFrom(body: string, offsetBase: number, properties: FolioPageProperties): readonly PageTask[] {
  const tasks: PageTask[] = [];
  for (const match of body.matchAll(TASK)) {
    const offset = offsetBase + (match.index ?? 0);
    tasks.push({
      text: match[2]!.trim(), completed: match[1]!.toLowerCase() === 'x',
      line: body.slice(0, match.index ?? 0).split('\n').length, offset,
      ...(properties.due === undefined ? {} : { due: properties.due }),
      ...(properties.status === undefined ? {} : { status: properties.status }),
      ...(properties.project === undefined ? {} : { project: properties.project }),
    });
  }
  return tasks;
}

export function parsePageDocument(input: PageDocumentInput): PageRecord {
  const frontmatter = extrairFrontmatter(input.source);
  const diagnostics: PageDiagnostic[] = frontmatter.problema === undefined ? [] : [{ field: 'frontmatter', message: frontmatter.problema.mensagem }];
  const properties = propertiesFrom(frontmatter.dados.folio, diagnostics);
  return {
    fileId: input.fileId, path: input.path, title: titleFor(input.path, frontmatter.dados), body: frontmatter.corpo,
    properties, tasks: tasksFrom(frontmatter.corpo, frontmatter.offsetDoCorpo, properties), diagnostics,
  };
}

function cleanProperties(properties: FolioPageProperties): Record<string, unknown> {
  return {
    ...(properties.id === undefined ? {} : { id: properties.id }),
    ...(properties.type === undefined ? {} : { type: properties.type }),
    ...(properties.status === undefined ? {} : { status: properties.status }),
    ...(properties.tags.length === 0 ? {} : { tags: properties.tags }),
    ...(properties.aliases.length === 0 ? {} : { aliases: properties.aliases }),
    ...(properties.due === undefined ? {} : { due: properties.due }),
    ...(properties.project === undefined ? {} : { project: properties.project }),
    ...(properties.relations.length === 0 ? {} : { relations: properties.relations }),
  };
}

/** Escrita explícita e idempotente: somente ela transforma um Markdown em página. */
export function pageSourceWithProperties(source: string, properties: FolioPageProperties): string {
  const frontmatter = extrairFrontmatter(source);
  const data = { ...frontmatter.dados, folio: cleanProperties(properties) };
  return `---\n${stringifyYaml(data).trimEnd()}\n---\n${frontmatter.corpo}`;
}

export function enablePageSource(source: string, id: string): string {
  const trimmed = id.trim();
  if (trimmed === '') throw new Error('Uma página exige identificador estável.');
  const page = parsePageDocument({ fileId: '', path: '', source });
  if (page.properties.id === trimmed) return source;
  return pageSourceWithProperties(source, { ...page.properties, id: page.properties.id ?? trimmed });
}

function fieldValue(page: PageRecord, field: PageField): string {
  if (field === 'title') return page.title;
  if (field === 'tags') return page.properties.tags.join(', ');
  return page.properties[field] ?? '';
}

export function filterPages(pages: readonly PageRecord[], filters: readonly PageFilter[]): readonly PageRecord[] {
  return pages.filter((page) => filters.every((filter) => fieldValue(page, filter.field).toLocaleLowerCase().includes(filter.value.trim().toLocaleLowerCase())));
}

export function sortPages(pages: readonly PageRecord[], sort: readonly PageSort[]): readonly PageRecord[] {
  return [...pages].sort((left, right) => {
    for (const rule of sort) {
      const comparison = fieldValue(left, rule.field).localeCompare(fieldValue(right, rule.field), 'pt-BR', { sensitivity: 'base' });
      if (comparison !== 0) return rule.direction === 'descending' ? -comparison : comparison;
    }
    return left.path.localeCompare(right.path, 'pt-BR');
  });
}

export function groupPages(pages: readonly PageRecord[], field: PageField): readonly PageGroup[] {
  const groups = new Map<string, PageRecord[]>();
  for (const page of pages) { const value = fieldValue(page, field) || 'Sem valor'; const group = groups.get(value) ?? []; group.push(page); groups.set(value, group); }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR')).map(([value, grouped]) => ({ value, pages: sortPages(grouped, [{ field: 'title' }]) }));
}

/** Arestas são projeções do Markdown e do frontmatter, nunca dados canônicos. */
export function pageGraphEdges(pages: readonly PageRecord[]): readonly PageGraphEdge[] {
  const known = new Map<string, string>();
  for (const page of pages) {
    if (page.properties.id !== undefined) known.set(page.properties.id, page.properties.id);
    known.set(page.path.replace(/\.md$/i, ''), page.properties.id ?? page.path);
    for (const alias of page.properties.aliases) known.set(alias, page.properties.id ?? page.path);
  }
  const edges: PageGraphEdge[] = [];
  for (const page of pages) {
    const from = page.properties.id ?? page.path;
    for (const match of page.body.matchAll(WIKILINK)) { const to = known.get(match[1]!.trim()); if (to !== undefined && to !== from) edges.push({ from, to, kind: 'wikilink' }); }
    for (const relation of page.properties.relations) if (relation.targetId !== from) edges.push({ from, to: relation.targetId, kind: 'declared-relation' });
  }
  return edges.filter((edge, index, all) => all.findIndex((candidate) => candidate.from === edge.from && candidate.to === edge.to && candidate.kind === edge.kind) === index);
}

export function backlinksFor(pages: readonly PageRecord[], pageId: string): readonly PageGraphEdge[] {
  return pageGraphEdges(pages).filter((edge) => edge.to === pageId);
}
