import { describe, expect, it } from 'vitest';
import { datasetMetadataForm, referenceReviewForm, selectedEntities, systematicReviewExtractionForm, validateForm, validateViewAction } from '../packages/academic-forms/src/index.js';
describe('F281–F287 — formulários e ações acadêmicas', () => {
  it('projeta formulário de extração a partir do schema da revisão', () => expect(systematicReviewExtractionForm([{ id: 'sample', label: 'Amostra', required: true }]).fields[0]).toMatchObject({ kind: 'textarea', required: true }));
  it('valida metadata de dataset e referência pela definição canônica', () => { expect(validateForm(datasetMetadataForm, { title: '' })).toContainEqual({ field: 'title', message: 'Campo obrigatório.' }); expect(validateForm(referenceReviewForm, { title: 'Artigo', type: 'article', year: 2025 })).toEqual([]); });
  it('liga ações ao Command Registry e seleciona entidades em lote', () => { expect(() => validateViewAction({ id: 'open', label: 'Abrir', commandId: 'document.open', selection: 'one' }, new Set(['document.open']))).not.toThrow(); expect(() => validateViewAction({ id: 'bad', label: 'Bad', commandId: 'eval', selection: 'one' }, new Set())).toThrow('Command Registry'); expect(selectedEntities([{ id: 'a' }, { id: 'b' }], ['b'])).toEqual([{ id: 'b' }]); });
});
