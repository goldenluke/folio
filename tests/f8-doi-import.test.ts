import { describe, expect, it } from 'vitest';

import { bibliographicEntityFromDoiPayload, resolveDoi } from '../apps/desktop/src/workspace/doi-resolver.js';

const PAYLOAD = {
  id: 'silva2024', type: 'article-journal', title: 'Pesquisa acadêmica',
  author: [{ family: 'Silva', given: 'João' }], issued: { 'date-parts': [[2024]] },
};

describe('F8 — importação por DOI', () => {
  it('normaliza o DTO do provedor para BibliographicEntity e completa DOI ausente', () => {
    expect(bibliographicEntityFromDoiPayload(PAYLOAD, 'https://doi.org/10.1234/teste')).toMatchObject({
      id: 'silva2024', type: 'article-journal', DOI: '10.1234/teste', author: [{ family: 'Silva' }],
    });
  });

  it('usa content negotiation e nunca expõe o DTO externo diretamente', async () => {
    const requests: Array<{ url: string; accept: string | undefined }> = [];
    const entry = await resolveDoi('doi: 10.1234/teste', async (url, init) => {
      requests.push({ url, accept: (init?.headers as Record<string, string> | undefined)?.Accept });
      return { ok: true, status: 200, json: async () => PAYLOAD };
    });
    expect(requests).toEqual([{ url: 'https://doi.org/10.1234%2Fteste', accept: 'application/vnd.citationstyles.csl+json' }]);
    expect(entry).toMatchObject({ id: 'silva2024', DOI: '10.1234/teste' });
  });

  it('recusa DOI inválido antes de tocar a rede', async () => {
    await expect(resolveDoi('não é DOI', async () => { throw new Error('não deveria chamar'); })).rejects.toThrow('DOI inválido');
  });
});
