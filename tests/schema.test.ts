import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { compilar } from '@abnt/cli';
import {
  carregarDocumentAst,
  gerarJsonSchema,
  migracoesRegistradas,
  SCHEMA_VERSION,
  validarDocumentAst,
  VersaoNaoSuportada,
} from '@abnt/document-model';
import { parseMarkdown, parseMarkdownComDiagnosticos } from '@abnt/markdown';

const AQUI = dirname(fileURLToPath(import.meta.url));
const fixture = (nome: string, arquivo: string): string =>
  join(AQUI, '..', 'fixtures', nome, arquivo);

describe('schema v1', () => {
  it('frontmatter inválido vira diagnóstico recuperável com posição', () => {
    const fonte = '---\ntitle: primeiro\ntitle: duplicado\n---\n\n# Corpo';

    expect(() => parseMarkdown(fonte, { documentId: 'invalido.md' })).not.toThrow();

    const resultado = parseMarkdownComDiagnosticos(fonte, {
      documentId: 'invalido.md',
    });

    expect(resultado.diagnostics).toHaveLength(1);
    expect(resultado.diagnostics[0]).toMatchObject({
      id: 'MD-FRONTMATTER-INVALIDO',
      severity: 'warning',
      source: {
        documentId: 'invalido.md',
        start: { offset: 0, line: 1, column: 1 },
      },
    });
    expect(validarDocumentAst(resultado.ast).ok).toBe(true);
  });

  it('aceita a saída do parser para os dois fixtures', async () => {
    for (const [pasta, arquivo] of [
      ['artigo', 'artigo.md'],
      ['completo', 'completo.md'],
    ] as const) {
      const fonte = await readFile(fixture(pasta, arquivo), 'utf8');
      const ast = parseMarkdown(fonte, { documentId: arquivo });

      const r = validarDocumentAst(ast);
      // Mensagem explícita: `expect(r.ok).toBe(true)` diria só "false".
      if (!r.ok) {
        throw new Error(
          `${arquivo} não validou:\n` +
            r.problemas.map((p) => `  ${p.caminho}: ${p.mensagem}`).join('\n'),
        );
      }
      expect(r.ok).toBe(true);
    }
  });

  it('rejeita AST malformada, apontando o campo', () => {
    const r = validarDocumentAst({
      schema: 'document-ast',
      version: 1,
      documentId: 'x',
      document: {
        id: 'n1',
        type: 'document',
        metadata: {},
        children: [{ id: 'n2', type: 'paragraph', children: [{ id: 'n3', type: 'text' }] }],
      },
      references: {},
      resources: {},
      notes: {},
    });

    expect(r.ok).toBe(false);
    if (r.ok) return;
    // O nó de texto está sem `value`; o caminho precisa levar até ele.
    expect(r.problemas.some((p) => p.caminho.includes('children'))).toBe(true);
  });

  it('rejeita valor que nem parece um document-ast', () => {
    const r = carregarDocumentAst({ foo: 'bar' });
    expect(r.ok).toBe(false);
  });

  it('recusa versão futura em vez de tentar abrir', () => {
    expect(() =>
      carregarDocumentAst({ schema: 'document-ast', version: SCHEMA_VERSION + 1 }),
    ).toThrow(VersaoNaoSuportada);
  });

  it('a cadeia de migrações é contígua', () => {
    // Vazia hoje. Quando deixar de ser, este teste garante que não há buraco
    // entre v1->v2->v3: um salto tornaria documentos de versão intermediária
    // impossíveis de abrir.
    const migracoes = migracoesRegistradas();
    let versao = 1;
    for (const m of migracoes) {
      expect(m.de).toBe(versao);
      expect(m.para).toBe(versao + 1);
      versao = m.para;
    }
    expect(versao).toBe(SCHEMA_VERSION);
  });

  it('o JSON Schema publicado está atualizado', async () => {
    // O JSON Schema é artefato versionado: é ele que permite ler e escrever o
    // formato fora do TypeScript. Fixá-lo aqui faz qualquer mudança no modelo
    // aparecer como diff revisável em vez de escapar silenciosamente.
    const schema = gerarJsonSchema();
    await expect(JSON.stringify(schema, null, 2)).toMatchFileSnapshot(
      '../packages/document-model/schema/v1.schema.json',
    );
  });
});

describe('roundtrip de serialização', () => {
  it('AST sobrevive a JSON.stringify -> parse -> validação', async () => {
    const fonte = await readFile(fixture('completo', 'completo.md'), 'utf8');
    const { ast } = await compilar(fonte, { documentId: 'completo.md' });

    const ida = JSON.parse(JSON.stringify(ast)) as unknown;
    const r = validarDocumentAst(ida);
    expect(r.ok).toBe(true);

    // Igualdade estrutural: nada se perde nem se inventa no caminho.
    expect(JSON.stringify(ida)).toBe(JSON.stringify(ast));
  });
});
