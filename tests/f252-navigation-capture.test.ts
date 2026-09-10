import { describe, expect, it } from 'vitest';
import { appendJournalCapture, captureNotePath, captureNoteSource, createBookmarks, createCaptureInbox, parseBookmarksDocument, parseCaptureInbox, researchJournalPath, researchJournalSource, slashCommands, validateWebClipperCapture } from '../packages/workspace-navigation/src/index.js';
describe('F252–F259 — navegação e captura acadêmica', () => {
  it('mantém bookmarks portáteis para entidades heterogêneas sem duplicar arquivos', () => expect(createBookmarks([{ version: 1, id: 'b1', label: 'Método', target: { kind: 'section', fileId: 'f1', path: 'metodo.md', offset: 42 }, createdAt: '2026-09-09T00:00:00Z' }])).toMatchObject({ bookmarks: [{ target: { kind: 'section' } }] }));
  it('valida a fronteira do clipper e não aceita esquemas executáveis', () => { expect(validateWebClipperCapture({ version: 1, url: 'https://example.org', selection: 'trecho', capturedAt: '2026-09-09T00:00:00Z' }).url).toBe('https://example.org'); expect(() => validateWebClipperCapture({ version: 1, url: 'file:///etc/passwd', capturedAt: 'x' })).toThrow('HTTP'); });
  it('reutiliza comandos e cria diário como Markdown comum', () => { expect(slashCommands('/fig')).toEqual([{ id: 'figure.insert', label: 'Inserir figura' }]); expect(researchJournalPath(new Date('2026-09-09T12:00:00Z'))).toBe('journal/2026-09-09.md'); expect(researchJournalSource(new Date('2026-09-09T12:00:00Z'))).toContain('Diário de pesquisa'); });
  it('F312–F318 — parseBookmarksDocument revalida conteúdo lido de disco', () => {
    const document = createBookmarks([{ version: 1, id: 'b1', label: 'Método', target: { kind: 'reference', referenceId: 'silva2024' }, createdAt: '2026-09-09T00:00:00Z' }]);
    expect(parseBookmarksDocument(JSON.parse(JSON.stringify(document)))).toEqual(document);
    expect(() => parseBookmarksDocument({ version: 2, bookmarks: [] })).toThrow('inválido');
    expect(() => parseBookmarksDocument({ version: 1, bookmarks: 'not-an-array' })).toThrow('inválido');
  });
  it('F331–F335 — appendJournalCapture insere bullets mais recentes primeiro, em lista compacta', () => {
    const template = researchJournalSource(new Date('2026-09-09T12:00:00Z'));
    const firstCapture = appendJournalCapture(template, 'Primeira observação');
    expect(firstCapture).toBe('# Diário de pesquisa — 2026-09-09\n\n## Observações\n\n- Primeira observação\n\n## Próximos passos\n');
    const secondCapture = appendJournalCapture(firstCapture, 'Segunda observação');
    expect(secondCapture).toBe('# Diário de pesquisa — 2026-09-09\n\n## Observações\n\n- Segunda observação\n- Primeira observação\n\n## Próximos passos\n');
    expect(appendJournalCapture('# Diário de pesquisa — 2026-09-09\n', 'Nota avulsa')).toBe('# Diário de pesquisa — 2026-09-09\n\n## Observações\n\n- Nota avulsa\n');
    expect(appendJournalCapture(template, 'Com\nquebra de linha')).toContain('- Com quebra de linha\n');
  });
  it('F336–F341 — mantém a inbox operacional separada e cria nota Markdown somente no encaminhamento', () => {
    const inbox = createCaptureInbox([{ id: 'capture-1', capturedAt: '2026-09-09T12:00:00Z', title: 'Página útil', url: 'https://example.org', selection: 'Trecho selecionado' }]);
    expect(parseCaptureInbox(JSON.parse(JSON.stringify(inbox)))).toEqual(inbox);
    expect(captureNotePath(inbox.items[0]!)).toBe('notas/capturas/capture-1.md');
    expect(captureNoteSource(inbox.items[0]!)).toContain('Fonte: https://example.org');
    expect(() => createCaptureInbox([{ id: 'x', capturedAt: 'now', url: 'file:///etc/passwd' }])).toThrow('HTTP');
  });
});
