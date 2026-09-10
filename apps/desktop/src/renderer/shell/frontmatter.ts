import { parseDocument } from 'yaml';

export interface MetadataDraft {
  readonly title: string; readonly subtitle: string; readonly authors: string; readonly advisor: string;
  readonly institution: string; readonly course: string; readonly city: string; readonly year: string;
  readonly keywords: string; readonly language: string; readonly profile: string; readonly bibliography: string; readonly coverLogo: string;
}

const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : typeof value === 'string' ? [value] : [];
export function metadataFromSource(source: string): MetadataDraft {
  const match = /^---\s*\n([\s\S]*?)\n---\s*\n?/u.exec(source);
  const raw = match === null ? {} : (parseDocument(match[1] ?? '').toJS() as Record<string, unknown> ?? {});
  const props = raw.properties as Record<string, unknown> | undefined;
  const contributors = Array.isArray(raw.contributors) ? raw.contributors as Record<string, unknown>[] : [];
  const authors = Array.isArray(raw.authors) ? raw.authors.map((item) => typeof item === 'string' ? item : typeof item === 'object' && item !== null ? String((item as Record<string, unknown>).name ?? '') : '').filter(Boolean) : strings(raw.authors);
  const advisor = contributors.find((item) => item.role === 'advisor')?.name;
  return { title: String(raw.title ?? ''), subtitle: String(raw.subtitle ?? ''), authors: authors.join('\n'), advisor: String(advisor ?? ''), institution: String(props?.['tcc:institution'] ?? ''), course: String(props?.['tcc:course'] ?? ''), city: String(props?.['tcc:place'] ?? ''), year: String(props?.['tcc:year'] ?? ''), keywords: strings(raw.keywords).join(', '), language: String(raw.lang ?? raw.language ?? ''), profile: String(raw.profile ?? ''), bibliography: strings(raw.bibliography).join(', '), coverLogo: typeof props?.['tcc:cover-logo'] === 'string' ? props['tcc:cover-logo'] : '' };
}
export function applyMetadata(source: string, draft: MetadataDraft): string {
  const match = /^---\s*\n([\s\S]*?)\n---\s*\n?/u.exec(source);
  const document = parseDocument(match?.[1] ?? ''); const raw = (document.toJS() as Record<string, unknown> ?? {});
  const scalar = (key: string, value: string): void => { if (value.trim() === '') delete raw[key]; else raw[key] = value.trim(); };
  scalar('title', draft.title); scalar('subtitle', draft.subtitle); scalar('lang', draft.language); scalar('profile', draft.profile);
  raw.authors = draft.authors.split('\n').map((item) => item.trim()).filter(Boolean).map((name) => ({ name }));
  raw.keywords = draft.keywords.split(',').map((item) => item.trim()).filter(Boolean); raw.bibliography = draft.bibliography.split(',').map((item) => item.trim()).filter(Boolean);
  const contributors = Array.isArray(raw.contributors) ? (raw.contributors as Record<string, unknown>[]).filter((item) => item.role !== 'advisor') : [];
  if (draft.advisor.trim() !== '') contributors.push({ name: draft.advisor.trim(), role: 'advisor' }); raw.contributors = contributors;
  const props = typeof raw.properties === 'object' && raw.properties !== null && !Array.isArray(raw.properties) ? raw.properties as Record<string, unknown> : {}; raw.properties = props;
  for (const [key, value] of [['tcc:institution', draft.institution], ['tcc:course', draft.course], ['tcc:place', draft.city], ['tcc:year', draft.year]] as const) { if (value.trim() === '') delete props[key]; else props[key] = key === 'tcc:year' && /^\d+$/u.test(value.trim()) ? Number(value) : value.trim(); }
  if (draft.coverLogo.trim() === '') delete props['tcc:cover-logo']; else props['tcc:cover-logo'] = draft.coverLogo;
  document.contents = document.createNode(raw) as unknown as typeof document.contents; return `---\n${String(document)}---\n${source.slice(match?.[0].length ?? 0)}`;
}
