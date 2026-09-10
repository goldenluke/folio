import { describe, expect, it } from 'vitest';
import { datasetCitation, inferSchema, registerDataset, reproducibilityManifest, tabularPreview, validateDictionary } from '../packages/research-data/src/index.js';

describe('F180–F190 — dados de pesquisa', () => {
  const dataset = registerDataset({ id: 'amostra', path: 'data/amostra.csv', bytes: new TextEncoder().encode('id,idade,ativo\n1,20,true\n2,,false\n'), metadata: { title: 'Amostra', creator: 'Pesquisadora', version: 'v1' } });
  it('registra formato, hash e versão de dataset', () => { expect(dataset).toMatchObject({ format: 'csv', metadata: { title: 'Amostra' } }); expect(dataset.sha256).toHaveLength(64); });
  it('projeta preview, schema e dicionário sem alterar bytes', () => {
    const preview = tabularPreview('id,idade,ativo\n1,20,true\n2,,false\n', 'csv'); if (preview === undefined) throw new Error('preview');
    expect(inferSchema(preview)).toEqual([{ name: 'id', type: 'number', missing: 0, distinct: 2 }, { name: 'idade', type: 'number', missing: 1, distinct: 1 }, { name: 'ativo', type: 'boolean', missing: 0, distinct: 2 }]);
    expect(validateDictionary(inferSchema(preview), [{ column: 'inexistente' }])).toHaveLength(1);
  });
  it('gera citação e manifesto reprodutível com hashes', () => {
    expect(datasetCitation(dataset)).toMatchObject({ type: 'dataset', title: 'Amostra' });
    expect(reproducibilityManifest('rev-7', [dataset], [{ id: 'a', datasetId: dataset.id, inputHash: dataset.sha256, scriptOrNotebook: 'analysis.ipynb', outputArtifact: 'figura.png', outputHash: 'out' }], ['figura.png'])).toMatchObject({ sourceRevision: 'rev-7', datasets: [{ id: 'amostra' }] });
  });
});
