/** Onda BJ (F454–F459). Relação explícita entre referências: estado operacional, nunca CSL-JSON canônico. */

import { findReferenceDuplicates } from '@abnt/bibliography';
import type { BibliographicEntity } from '@abnt/document-model';

export type ReferenceRelationKind = 'version-of' | 'extension-of' | 'replica-of' | 'revision-of' | 'correction-of';

const KINDS: readonly ReferenceRelationKind[] = ['version-of', 'extension-of', 'replica-of', 'revision-of', 'correction-of'];
const isRelationKind = (value: unknown): value is ReferenceRelationKind => KINDS.includes(value as ReferenceRelationKind);

export interface ReferenceRelation {
  readonly id: string;
  readonly kind: ReferenceRelationKind;
  readonly fromId: string;
  readonly toId: string;
  readonly note?: string;
  readonly createdAt: string;
}

export interface ReferenceRelationSet { readonly version: 1; readonly relations: readonly ReferenceRelation[]; }

export interface CreateReferenceRelationInput {
  readonly id: string;
  readonly kind: ReferenceRelationKind;
  readonly fromId: string;
  readonly toId: string;
  readonly note?: string;
  readonly createdAt: string;
}

/** `fromId`/`toId` nunca podem coincidir: uma referência não se relaciona consigo mesma. */
export function createReferenceRelation(input: CreateReferenceRelationInput): ReferenceRelation {
  if (input.id.trim() === '') throw new Error('Relação exige identidade.');
  if (!isRelationKind(input.kind)) throw new Error(`Tipo de relação inválido: ${String(input.kind)}.`);
  if (input.fromId.trim() === '' || input.toId.trim() === '') throw new Error('Relação exige as duas referências.');
  if (input.fromId === input.toId) throw new Error('Uma referência não pode se relacionar consigo mesma.');
  if (input.createdAt.trim() === '') throw new Error('Relação exige data de criação.');
  return {
    id: input.id, kind: input.kind, fromId: input.fromId, toId: input.toId, createdAt: input.createdAt,
    ...(input.note === undefined ? {} : { note: input.note }),
  };
}

export function createReferenceRelationSet(relations: readonly ReferenceRelation[] = []): ReferenceRelationSet {
  const ids = new Set<string>();
  for (const relation of relations) { if (ids.has(relation.id)) throw new Error(`Relação duplicada: ${relation.id}.`); ids.add(relation.id); }
  return { version: 1, relations };
}

/** Entrada individual corrompida é descartada, nunca derruba o conjunto inteiro (mesma postura de `parseAttachmentManifest`, Onda BH). */
export function parseReferenceRelationSet(input: unknown): ReferenceRelationSet {
  if (typeof input !== 'object' || input === null || (input as { version?: unknown }).version !== 1 || !Array.isArray((input as { relations?: unknown }).relations)) {
    return createReferenceRelationSet([]);
  }
  const seen = new Set<string>();
  const relations: ReferenceRelation[] = [];
  for (const candidate of (input as { relations: readonly unknown[] }).relations) {
    try {
      const relation = createReferenceRelation(candidate as CreateReferenceRelationInput);
      if (seen.has(relation.id)) continue;
      seen.add(relation.id);
      relations.push(relation);
    } catch { /* entrada corrompida: descarta e segue */ }
  }
  return { version: 1, relations };
}

export function relationsForReference(set: ReferenceRelationSet, referenceId: string): readonly ReferenceRelation[] {
  return set.relations.filter((relation) => relation.fromId === referenceId || relation.toId === referenceId);
}

export function addReferenceRelation(set: ReferenceRelationSet, relation: ReferenceRelation): ReferenceRelationSet {
  if (set.relations.some((entry) => entry.id === relation.id)) throw new Error(`Relação duplicada: ${relation.id}.`);
  return createReferenceRelationSet([...set.relations, relation]);
}

export function removeReferenceRelation(set: ReferenceRelationSet, relationId: string): ReferenceRelationSet {
  return { version: 1, relations: set.relations.filter((relation) => relation.id !== relationId) };
}

/**
 * "Relação não equivale a duplicata": reaproveita o mesmo motor de F53/F128
 * (`@abnt/bibliography`) para recusar uma relação explícita entre duas
 * entradas que o motor já sinalizaria para merge — a decisão correta ali é
 * mesclar, não relacionar.
 */
export function assertNotDuplicate(fromId: string, fromEntity: BibliographicEntity, toId: string, toEntity: BibliographicEntity): void {
  const duplicates = findReferenceDuplicates({ [fromId]: fromEntity, [toId]: toEntity });
  if (duplicates.length > 0) {
    throw new Error(`“${fromId}” e “${toId}” parecem duplicatas (${duplicates[0]!.reasons.join(', ')}) — mescle em vez de relacionar.`);
  }
}

export interface ReferenceRelationEdge {
  readonly from: { readonly kind: 'reference'; readonly id: string };
  readonly to: { readonly kind: 'reference'; readonly id: string };
  readonly relationKind: ReferenceRelationKind;
}

/** Projeção pura para o grafo: o host decide como compor com `buildWorkspaceGraph` (`@abnt/workspace-graph`). */
export function referenceRelationEdges(set: ReferenceRelationSet): readonly ReferenceRelationEdge[] {
  return set.relations.map((relation) => ({
    from: { kind: 'reference', id: relation.fromId },
    to: { kind: 'reference', id: relation.toId },
    relationKind: relation.kind,
  }));
}
