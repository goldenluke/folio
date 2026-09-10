import { describe, expect, it } from 'vitest';

import {
  addReferenceRelation,
  assertNotDuplicate,
  createReferenceRelation,
  createReferenceRelationSet,
  parseReferenceRelationSet,
  referenceRelationEdges,
  relationsForReference,
  removeReferenceRelation,
} from '../packages/reference-relations/src/index.js';

describe('F454–F459 — Explicit Reference Relations', () => {
  it('cria relação válida e rejeita papel inválido, referências iguais ou identidade ausente', () => {
    const relation = createReferenceRelation({ id: 'r1', kind: 'revision-of', fromId: 'silva2026b', toId: 'silva2026a', createdAt: '2026-09-10T00:00:00.000Z', note: 'Errata do autor' });
    expect(relation).toMatchObject({ kind: 'revision-of', fromId: 'silva2026b', toId: 'silva2026a' });
    expect(() => createReferenceRelation({ id: '', kind: 'revision-of', fromId: 'a', toId: 'b', createdAt: '2026-09-10' })).toThrow('identidade');
    expect(() => createReferenceRelation({ id: 'r2', kind: 'invalido' as never, fromId: 'a', toId: 'b', createdAt: '2026-09-10' })).toThrow('Tipo de relação');
    expect(() => createReferenceRelation({ id: 'r3', kind: 'revision-of', fromId: 'a', toId: 'a', createdAt: '2026-09-10' })).toThrow('consigo mesma');
  });

  it('acrescenta e remove relações do conjunto, rejeitando id duplicado', () => {
    const relation = createReferenceRelation({ id: 'r1', kind: 'extension-of', fromId: 'b', toId: 'a', createdAt: '2026-09-10' });
    const set = addReferenceRelation(createReferenceRelationSet(), relation);
    expect(set.relations).toHaveLength(1);
    expect(() => addReferenceRelation(set, relation)).toThrow('duplicada');
    const cleared = removeReferenceRelation(set, 'r1');
    expect(cleared.relations).toHaveLength(0);
  });

  it('encontra relações de uma referência nos dois sentidos (origem ou destino)', () => {
    const set = createReferenceRelationSet([
      createReferenceRelation({ id: 'r1', kind: 'version-of', fromId: 'b', toId: 'a', createdAt: '2026-09-10' }),
      createReferenceRelation({ id: 'r2', kind: 'replica-of', fromId: 'c', toId: 'b', createdAt: '2026-09-10' }),
    ]);
    expect(relationsForReference(set, 'b').map((relation) => relation.id).sort()).toEqual(['r1', 'r2']);
    expect(relationsForReference(set, 'a').map((relation) => relation.id)).toEqual(['r1']);
    expect(relationsForReference(set, 'zzz')).toEqual([]);
  });

  it('descarta relação corrompida do JSON sem derrubar o conjunto inteiro', () => {
    const set = parseReferenceRelationSet({ version: 1, relations: [{ id: 'r1', kind: 'version-of', fromId: 'b', toId: 'a', createdAt: '2026-09-10' }, { id: 'r2', kind: 'invalido' }] });
    expect(set.relations).toHaveLength(1);
    expect(parseReferenceRelationSet({ garbage: true })).toEqual({ version: 1, relations: [] });
  });

  it('recusa relação entre entradas que o motor de duplicatas já sinalizaria para merge', () => {
    const original = { id: 'silva2026', type: 'article-journal' as const, title: 'Pesquisa em ABNT', DOI: '10.1000/abc' };
    const almostSame = { id: 'silva2026-dup', type: 'article-journal' as const, title: 'Pesquisa em ABNT', DOI: '10.1000/abc' };
    expect(() => assertNotDuplicate('silva2026-dup', almostSame, 'silva2026', original)).toThrow('duplicatas');
    const genuinelyDifferent = { id: 'costa2020', type: 'article-journal' as const, title: 'Outro assunto qualquer' };
    expect(() => assertNotDuplicate('costa2020', genuinelyDifferent, 'silva2026', original)).not.toThrow();
  });

  it('projeta o conjunto como arestas prontas para o grafo', () => {
    const set = createReferenceRelationSet([createReferenceRelation({ id: 'r1', kind: 'correction-of', fromId: 'errata2026', toId: 'silva2026', createdAt: '2026-09-10' })]);
    expect(referenceRelationEdges(set)).toEqual([{ from: { kind: 'reference', id: 'errata2026' }, to: { kind: 'reference', id: 'silva2026' }, relationKind: 'correction-of' }]);
  });
});
