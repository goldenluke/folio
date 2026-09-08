import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { asContentHash, criarCompiler, PERFIS_PADRAO } from '@abnt/compiler';
import { prepararAmbienteLocal } from '@abnt/cli';
import { asDocumentId, asReferenceId } from '@abnt/document-model';
import type { BibliographicEntity } from '@abnt/document-model';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(HERE, '..', 'fixtures', 'm4');

const snapshot = async () => {
  const content = await readFile(join(FIXTURE_DIR, 'artigo.md'), 'utf8');
  return {
    documentId: asDocumentId('artigo.md'),
    revision: 7,
    content,
    contentHash: asContentHash('sha256:fixture-m4'),
  };
};

describe('P0 — compiler headless e Compilation Environment', () => {
  it('combina ambiente local sem hidratar a Document AST', async () => {
    const compiler = criarCompiler();
    const prepared = await compiler.prepare(await snapshot());

    expect(prepared.dependencies.bibliographyUris).toEqual(['referencias.bib']);
    expect(prepared.dependencies.resources.map((resource) => resource.authoredUri)).toEqual([
      '../completo/figuras/arquitetura.svg',
    ]);
    expect(Object.keys(prepared.document.references)).toHaveLength(0);
    expect(Object.values(prepared.document.resources)[0]?.uri).toBe(
      '../completo/figuras/arquitetura.svg',
    );

    const environment = await prepararAmbienteLocal(prepared, {
      baseDir: FIXTURE_DIR,
      embutirRecursos: true,
    });
    const result = await compiler.compile({ prepared, environment });

    expect(result.documentId).toBe('artigo.md');
    expect(result.revision).toBe(7);
    expect(result.contentHash).toBe('sha256:fixture-m4');
    expect(Object.keys(result.ast.references)).toHaveLength(0);
    expect(Object.keys(result.resolved.bibliography)).toHaveLength(1);
    expect(Object.values(result.ast.resources)[0]?.uri).toBe('../completo/figuras/arquitetura.svg');
    expect(JSON.stringify(environment.environment)).toContain('sha256:');
    expect(JSON.stringify(result.publication)).toContain('data:image/svg+xml;base64,');
    expect('html' in result).toBe(false);
  });

  it('honra cancelamento antes de iniciar o parse', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(criarCompiler().prepare(await snapshot(), controller.signal)).rejects.toThrow(
      'Compilação cancelada.',
    );
  });

  it('aceita registro de profiles do host sem acoplar o compiler ao CLI', async () => {
    const compiler = criarCompiler({
      profiles: { defaultProfileId: 'web-article', profiles: PERFIS_PADRAO },
    });
    const prepared = await compiler.prepare(await snapshot());
    const environment = await prepararAmbienteLocal(prepared, { baseDir: FIXTURE_DIR });

    const result = await compiler.compile({ prepared, environment });
    expect(result.profileId).toBe('web-article');
    expect(result.publication.page.size).toBe('Letter');
  });

  it('prefere referência autoral e diagnostica colisão com o ambiente', async () => {
    const compiler = criarCompiler();
    const parsed = await compiler.prepare({
      documentId: asDocumentId('colisao.md'),
      revision: 1,
      content: 'Texto [@a].',
      contentHash: asContentHash('sha256:colisao'),
    });
    const authorReference: BibliographicEntity = {
      id: asReferenceId('a'),
      type: 'book',
      title: 'Versão autoral',
    };
    const environmentReference: BibliographicEntity = {
      id: asReferenceId('a'),
      type: 'book',
      title: 'Versão do ambiente',
    };
    const prepared = {
      ...parsed,
      document: { ...parsed.document, references: { a: authorReference } },
    };

    const result = await compiler.compile({
      prepared,
      environment: {
        environment: {
          bibliography: {
            entries: { a: environmentReference },
            sources: [],
            provenanceByReference: {},
          },
          resources: {},
          dependencies: { bibliography: [], resources: [] },
        },
        diagnostics: [],
      },
    });

    expect(result.resolved.bibliography['a']?.title).toBe('Versão autoral');
    expect(result.diagnostics.some((diagnostic) => diagnostic.id === 'BIBLIOGRAFIA-CHAVE-DUPLICADA')).toBe(true);
  });
});
