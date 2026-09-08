import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { compilar } from '@abnt/cli';
import type { DocumentAst, ListNode } from '@abnt/document-model';
import { percorrerTudo, validarDocumentAst } from '@abnt/document-model';
import { parseMarkdown } from '@abnt/markdown';
import { normalizarDocumento } from '@abnt/semantics';

/**
 * Testes baseados em propriedade.
 *
 * Golden test fixa um caso concreto; estes fixam afirmações que precisam valer
 * para *qualquer* entrada. É o que pega a categoria de defeito que fixture não
 * pega — a construção que ninguém pensou em escrever no fixture.
 *
 * O gerador não produz Markdown aleatório de verdade: produz combinações de
 * construções válidas. Ruído puro só exercitaria o caminho de "texto solto".
 */

const textoSimples = fc
  .stringMatching(/^[A-Za-zÀ-ÿ0-9 ,.;:!?()-]{1,60}$/)
  .filter((s) => s.trim().length > 0);

const chave = fc.stringMatching(/^[a-z][a-z0-9]{2,10}$/);

const bloco: fc.Arbitrary<string> = fc.oneof(
  textoSimples.map((t) => t),
  fc.tuple(fc.integer({ min: 1, max: 6 }), textoSimples).map(([n, t]) => `${'#'.repeat(n)} ${t}`),
  textoSimples.map((t) => `> ${t}`),
  fc.array(textoSimples, { minLength: 1, maxLength: 4 }).map((is) => is.map((i) => `- ${i}`).join('\n')),
  fc.array(textoSimples, { minLength: 1, maxLength: 4 }).map((is) => is.map((i, k) => `${k + 1}. ${i}`).join('\n')),
  textoSimples.map((t) => `    ${t}`),
  fc.constant('---'),
  fc.tuple(textoSimples, chave).map(([t, c]) => `${t} [@${c}, p. 12].`),
  fc.tuple(textoSimples, chave).map(([t, c]) => `Segundo @${c}, ${t}`),
  textoSimples.map((t) => `**${t}**`),
  textoSimples.map((t) => `*${t}*`),
  textoSimples.map((t) => `\`${t}\``),
  fc.tuple(textoSimples, textoSimples).map(([a, b]) => `| ${a} | ${b} |\n| --- | --- |\n| ${a} | ${b} |`),
  fc.tuple(textoSimples, textoSimples).map(([a, b]) => `${a}[^n1]\n\n[^n1]: ${b}`),
);

const documento = fc.array(bloco, { minLength: 1, maxLength: 10 }).map((bs) => bs.join('\n\n'));

describe('propriedades do parser', () => {
  it('todo node id é único no documento', () => {
    fc.assert(
      fc.property(documento, (fonte) => {
        const ast = parseMarkdown(fonte, { documentId: 'p.md' });
        const vistos = new Set<string>();
        for (const no of percorrerTudo(ast)) {
          // Id duplicado quebraria índice, anotação e referência cruzada de
          // forma silenciosa: o segundo nó sobrescreveria o primeiro.
          expect(vistos.has(no.id)).toBe(false);
          vistos.add(no.id);
        }
      }),
      { numRuns: 250 },
    );
  });

  it('a saída sempre valida contra o schema', () => {
    fc.assert(
      fc.property(documento, (fonte) => {
        const ast = parseMarkdown(fonte, { documentId: 'p.md' });
        const r = validarDocumentAst(ast);
        if (!r.ok) {
          throw new Error(
            `Entrada:\n${fonte}\n\nProblemas:\n` +
              r.problemas.map((p) => `  ${p.caminho}: ${p.mensagem}`).join('\n'),
          );
        }
      }),
      { numRuns: 250 },
    );
  });

  it('o parse é determinístico', () => {
    fc.assert(
      fc.property(documento, (fonte) => {
        const a = parseMarkdown(fonte, { documentId: 'p.md' });
        const b = parseMarkdown(fonte, { documentId: 'p.md' });
        // Necessário para snapshot e para cache por hash de conteúdo (M2).
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      }),
      { numRuns: 100 },
    );
  });

  it('a normalização é idempotente e preserva AST já canônica', () => {
    fc.assert(
      fc.property(documento, (fonte) => {
        const ast = parseMarkdown(fonte, { documentId: 'p.md' });
        const uma = normalizarDocumento(ast);
        const duas = normalizarDocumento(uma);
        expect(JSON.stringify(duas)).toBe(JSON.stringify(uma));
        expect(duas).toBe(uma);
      }),
      { numRuns: 100 },
    );
  });

  it('a normalização converge formas equivalentes de lista', () => {
    const ast = parseMarkdown('- item', { documentId: 'p.md' });
    const lista = ast.document.children[0] as ListNode;
    const naoCanonica = {
      ...ast,
      document: {
        ...ast.document,
        children: [{ ...lista, ordered: false, start: 1 }],
      },
    } as DocumentAst;

    const uma = normalizarDocumento(naoCanonica);
    const duas = normalizarDocumento(uma);
    expect((uma.document.children[0] as ListNode).start).toBeUndefined();
    expect(duas).toBe(uma);
  });

  it('todo offset de origem cai dentro do arquivo e é bem ordenado', () => {
    fc.assert(
      fc.property(documento, (fonte) => {
        const ast = parseMarkdown(fonte, { documentId: 'p.md' });
        for (const no of percorrerTudo(ast)) {
          if (no.source === undefined) continue;
          const { start, end } = no.source;
          // Offset fora do arquivo faz o diagnóstico apontar para o vazio, e
          // faz o editor destacar a região errada.
          expect(start.offset).toBeGreaterThanOrEqual(0);
          expect(end.offset).toBeLessThanOrEqual(fonte.length);
          expect(start.offset).toBeLessThanOrEqual(end.offset);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('o pipeline inteiro não lança para nenhuma entrada gerada', async () => {
    await fc.assert(
      fc.asyncProperty(documento, async (fonte) => {
        // Documento do usuário é entrada não confiável: o compilador pode
        // diagnosticar, mas não pode quebrar.
        await expect(compilar(fonte, { documentId: 'p.md' })).resolves.toBeDefined();
      }),
      { numRuns: 150 },
    );
  });
});

describe('propriedades do frontmatter', () => {
  it('offsets continuam corretos com frontmatter de qualquer tamanho', () => {
    fc.assert(
      fc.property(
        fc.array(fc.stringMatching(/^[a-z]{3,8}$/), { minLength: 0, maxLength: 12 }),
        textoSimples,
        (chaves, corpo) => {
          const fm =
            chaves.length === 0
              ? ''
              : `---\n${chaves.map((k, i) => `${k}: valor${i}`).join('\n')}\n---\n\n`;
          const fonte = `${fm}# Título\n\n${corpo}`;

          const ast = parseMarkdown(fonte, { documentId: 'p.md' });

          for (const no of percorrerTudo(ast)) {
            if (no.source === undefined || no.type !== 'text') continue;
            // O trecho apontado pelo offset precisa ser o texto do nó — é
            // exatamente aqui que um erro de correção do frontmatter aparece,
            // e ele cresce com o tamanho do frontmatter.
            const trecho = fonte.slice(no.source.start.offset, no.source.end.offset);
            expect(trecho).toBe(no.value);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
