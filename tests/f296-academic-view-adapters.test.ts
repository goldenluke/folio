import { describe, expect, it } from 'vitest';
import { annotationViewRows, datasetViewRows, projectViewRows, reviewStudyViewRows } from '../packages/academic-views/src/index.js';
describe('F296–F299 — adapters de Academic Views', () => {
  it('projeta projetos sem expor seu store operacional', () => expect(projectViewRows([{ id: 'p', title: 'Tese', updatedAt: '2026-09-09', milestones: [{ id: 'm', title: 'Entrega', dueDate: '2026-10-01' }] }])[0]).toMatchObject({ title: 'Tese', fields: { status: 'active', milestones: 1 } }));
  it('projeta datasets, estudos e anotações como linhas derivadas', () => { expect(datasetViewRows([{ id: 'd', path: 'data.csv', format: 'csv', metadata: { title: 'Dados', version: '1' } }])[0]?.fields.format).toBe('csv'); expect(reviewStudyViewRows([{ id: 's', title: 'Estudo', stage: 'included' }])[0]?.fields.stage).toBe('included'); expect(annotationViewRows([{ id: 'a', referenceId: 'silva', page: 2, quote: 'Trecho', createdAt: 'x' }])[0]?.title).toBe('Trecho'); });
});
