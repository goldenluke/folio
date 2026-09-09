import type { BibliographicEntity, CslName } from '@abnt/document-model';
import { documentTarget } from '@abnt/language-service';
import type { WorkspaceFile, WorkspaceFileId } from '@abnt/workspace-core';
import type { IndexedCitation, IndexedLink, IndexedResource } from '@abnt/workspace-index';

import {
  documentNodeId,
  organizationNodeId,
  personNodeId,
  referenceNodeId,
  resourceNodeId,
  tagNodeId,
  type WorkspaceGraph,
  type WorkspaceGraphEdge,
  type WorkspaceGraphNode,
} from './model.js';

export interface WorkspaceBibliographyEntry {
  readonly entity: BibliographicEntity;
  readonly sourceFileId?: WorkspaceFileId;
}

export interface WorkspaceGraphSources {
  readonly files: readonly WorkspaceFile[];
  readonly links: readonly IndexedLink[];
  readonly citations: readonly IndexedCitation[];
  readonly resources: readonly IndexedResource[];
  readonly titles?: ReadonlyMap<WorkspaceFileId, string>;
  /** Alimenta F33 (nós person/organization); ausente = grafo F5 v1 sem pessoas. */
  readonly bibliography?: ReadonlyMap<string, WorkspaceBibliographyEntry>;
  /** F56: tags projetadas pelo host a partir do frontmatter/corpo autoral. */
  readonly tags?: readonly { readonly fileId: WorkspaceFileId; readonly tags: readonly string[] }[];
}

const stripDiacritics = (value: string): string => value.normalize('NFKD').replace(/[\u0300-\u036f]/gu, '');

const entitySlug = (parts: readonly (string | undefined)[]): string => {
  const slug = stripDiacritics(parts.filter((part): part is string => typeof part === 'string' && part.length > 0).join(' '))
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/(^-+|-+$)/gu, '');
  return slug === '' ? 'desconhecido' : slug;
};

const personSlug = (name: CslName): string => entitySlug([name.given, name.family]);

const personLabel = (name: CslName): string => {
  if (name.literal !== undefined) return name.literal;
  const parts = [name.given, name.family].filter((part): part is string => typeof part === 'string' && part.length > 0);
  return parts.length === 0 ? 'Autor desconhecido' : parts.join(' ');
};

const normalizedPersonName = (name: CslName): string => entitySlug([name.given, name.family]);
const familyKey = (name: CslName): string => entitySlug([name.family]);
const recordOrcid = (entry: BibliographicEntity): string | undefined => {
  const value = entry.custom?.orcid;
  return typeof value === 'string' && value.trim() !== '' ? value.trim().toLocaleLowerCase() : undefined;
};

/**
 * Puro e síncrono: monta o grafo a partir de projeções que o host já buscou
 * (storage.list() + index.links()/citations()/resources()), nunca acessando
 * I/O por conta própria — testável sem SQLite/MessagePort. `links-to` resolve
 * via `documentTarget`, a MESMA função que `definition`/`references`/
 * `backlinks` já usam para link relativo — nunca uma segunda resolução
 * (ver docs/adr/0016). `bibliography` é opcional: F5 v1 não precisa dela, só
 * F33 (person/organization) a alimenta.
 */
export function buildWorkspaceGraph(sources: WorkspaceGraphSources): WorkspaceGraph {
  const nodes = new Map<string, WorkspaceGraphNode>();
  const edges: WorkspaceGraphEdge[] = [];
  const pathToFileId = new Map(sources.files.map((file) => [String(file.path), file.id] as const));

  for (const file of sources.files) {
    const id = documentNodeId(file.id);
    nodes.set(id, {
      id,
      kind: 'document',
      label: sources.titles?.get(file.id) ?? String(file.path),
      fileId: file.id,
      path: file.path,
    });
  }

  for (const link of sources.links) {
    if (link.kind !== 'document') continue;
    const resolvedPath = documentTarget(link.path, link.target);
    const targetFileId = resolvedPath === undefined ? undefined : pathToFileId.get(resolvedPath);
    if (targetFileId === undefined) continue;
    edges.push({
      kind: 'links-to',
      from: documentNodeId(link.fileId),
      to: documentNodeId(targetFileId),
      sourceFileId: link.fileId,
      ...(link.sourceStart !== undefined ? { sourceStart: link.sourceStart } : {}),
      ...(link.sourceEnd !== undefined ? { sourceEnd: link.sourceEnd } : {}),
    });
  }

  for (const citation of sources.citations) {
    const refNodeId = referenceNodeId(citation.referenceId);
    if (!nodes.has(refNodeId)) {
      const known = sources.bibliography?.get(citation.referenceId);
      nodes.set(refNodeId, {
        id: refNodeId,
        kind: 'reference',
        label: known?.entity.title ?? citation.referenceId,
        referenceId: citation.referenceId,
        resolved: known !== undefined,
      });
    }
    edges.push({
      kind: 'cites',
      from: documentNodeId(citation.fileId),
      to: refNodeId,
      sourceFileId: citation.fileId,
      ...(citation.sourceStart !== undefined ? { sourceStart: citation.sourceStart } : {}),
      ...(citation.sourceEnd !== undefined ? { sourceEnd: citation.sourceEnd } : {}),
    });
  }

  for (const resource of sources.resources) {
    const id = resourceNodeId(resource.resourceId);
    if (!nodes.has(id)) nodes.set(id, { id, kind: 'resource', label: resource.uri });
    edges.push({ kind: 'embeds', from: documentNodeId(resource.fileId), to: id, sourceFileId: resource.fileId });
  }

  if (sources.bibliography !== undefined) {
    const people: { readonly name: CslName }[] = [];
    for (const [, entry] of sources.bibliography) {
      for (const name of entry.entity.author ?? entry.entity.editor ?? []) if (name.literal === undefined) people.push({ name });
    }
    const exactCounts = new Map<string, number>();
    const familyGiven = new Map<string, Set<string>>();
    for (const person of people) {
      const exact = normalizedPersonName(person.name); const family = familyKey(person.name);
      exactCounts.set(exact, (exactCounts.get(exact) ?? 0) + 1);
      if (family !== '') familyGiven.set(family, new Set([...(familyGiven.get(family) ?? []), exact]));
    }
    for (const [referenceId, entry] of sources.bibliography) {
      const refNodeId = referenceNodeId(referenceId);
      const existing = nodes.get(refNodeId);
      nodes.set(refNodeId, {
        id: refNodeId,
        kind: 'reference',
        label: entry.entity.title ?? existing?.label ?? referenceId,
        referenceId,
        resolved: true,
      });

      for (const [index, author] of (entry.entity.author ?? entry.entity.editor ?? []).entries()) {
        if (author.literal !== undefined) {
          const id = organizationNodeId(entitySlug([author.literal]));
          if (!nodes.has(id)) nodes.set(id, { id, kind: 'organization', label: author.literal });
          edges.push({ kind: 'authored-by', from: refNodeId, to: id });
          continue;
        }
        const exact = normalizedPersonName(author); const family = familyKey(author);
        const orcid = entry.entity.author?.length === 1 ? recordOrcid(entry.entity) : undefined;
        // Sem identificador forte não colapsamos homônimos em um nó só.
        const id = personNodeId(orcid === undefined ? `${personSlug(author)}:${referenceId}:${index}` : `orcid:${orcid}`);
        const identityState = orcid !== undefined
          ? 'resolved'
          : (familyGiven.get(family)?.size ?? 0) > 1 ? 'ambiguous'
            : (exactCounts.get(exact) ?? 0) > 1 ? 'possible-match' : 'possible-match';
        if (!nodes.has(id)) nodes.set(id, { id, kind: 'person', label: personLabel(author), identityState });
        edges.push({ kind: 'authored-by', from: refNodeId, to: id });
      }
    }
  }

  if (sources.tags !== undefined) {
    for (const entry of sources.tags) {
      for (const tag of entry.tags) {
        const id = tagNodeId(tag);
        if (!nodes.has(id)) nodes.set(id, { id, kind: 'tag', label: `#${tag}` });
        edges.push({ kind: 'tagged-with', from: documentNodeId(entry.fileId), to: id, sourceFileId: entry.fileId });
      }
    }
  }

  return { nodes: [...nodes.values()], edges };
}
