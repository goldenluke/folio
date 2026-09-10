import { describe, expect, it } from 'vitest';

import { asNodeId, asReferenceId, percorrer, type DocumentAst, type FigureNode } from '@abnt/document-model';
import { parseMarkdown } from '@abnt/markdown';
import { compilarPublicacao } from '@abnt/publication';
import {
  executarPasses,
  executarPassesSemanticos,
  PASSES_SEMANTICOS,
  resolverDocumento,
  TEXTO_DA_REFERENCIA_CRUZADA,
} from '@abnt/semantics';
import { perfilArtigoAbnt, perfilArtigoApa, validarArtigoAbnt, validarArtigoApa } from '@abnt/standards';

const reference = (id: string): DocumentAst['references'][string] => ({
  id: asReferenceId(id),
  type: 'book',
  title: `Obra ${id}`,
  author: [{ family: 'Silva', given: 'Ana' }],
  issued: { 'date-parts': [[2024]] },
  publisher: 'Editora Exemplo',
});

function documentoComFiguraEReferencia(): DocumentAst {
  const original = parseMarkdown(
    [
      '---',
      'abstract: Curto.',
      '---',
      '',
      'Consulte o modelo [@ausente].',
      '',
      '> Trecho literal.',
      '',
      '![Modelo](modelo.svg)',
    ].join('\n'),
    { documentId: 'm3.md' },
  );
  const figure = [...percorrer(original)].find((node): node is FigureNode => node.type === 'figure');
  if (figure === undefined) throw new Error('fixture de M3 sem figura');

  return {
    ...original,
    references: { fonte: reference('fonte'), nunca: reference('nunca') },
    document: {
      ...original.document,
      children: original.document.children.map((node) => {
        if (node.id === figure.id) {
          // O parser usa o alt da imagem como legenda inicial; retiramos aqui
          // para exercitar a regra que exige uma legenda declarada.
          const { caption: _caption, ...withoutCaption } = node;
          return { ...withoutCaption, attributes: { identifier: 'fig:modelo' } };
        }
        if (node.type === 'paragraph' && node.children.some((child) => child.type === 'citation')) {
          return {
            ...node,
            children: [
              ...node.children,
              {
                id: asNodeId('xref-1'),
                type: 'cross-reference' as const,
                target: { kind: 'identifier' as const, identifier: 'fig:modelo' },
                presentation: 'label' as const,
              },
            ],
          };
        }
        if (node.type === 'quote') {
          return {
            ...node,
            attribution: { citations: [{ referenceId: asReferenceId('fonte') }] },
          };
        }
        return node;
      }),
    },
  };
}

describe('M3 — passes semânticos', () => {
  it('mantém um contrato de passe genérico, encadeado e isoladamente testável', () => {
    const result = executarPasses(
      1,
      [
        { id: 'teste:dobrar', execute: (value: number) => value * 2 },
        { id: 'teste:somar', execute: (value: number) => value + 3 },
      ],
      undefined,
    );

    expect(result).toBe(5);
    expect(PASSES_SEMANTICOS.map((pass) => pass.id)).toEqual([
      'semantic:normalize',
      'semantic:number-sections',
      'semantic:number-elements',
      'semantic:index-identifiers',
      'semantic:resolve-citations',
      'semantic:resolve-cross-references',
    ]);
  });

  it('resolve cross-reference para texto derivado e não delega a decisão à publicação', () => {
    const ast = documentoComFiguraEReferencia();
    const resolved = executarPassesSemanticos(ast);
    const text = resolved.annotations.getString(asNodeId('xref-1'), TEXTO_DA_REFERENCIA_CRUZADA);

    expect(text).toBe('Figura 1');
    expect(resolved.diagnostics.some((diagnostic) => diagnostic.id === 'XREF-NAO-RESOLVIDA')).toBe(false);

    const publication = compilarPublicacao(resolverDocumento(ast), perfilArtigoAbnt);
    expect(JSON.stringify(publication.documento)).toContain('Figura 1');
    expect(publication.diagnosticos.some((diagnostic) => diagnostic.id.startsWith('XREF-'))).toBe(false);
  });

  it('produz um diagnóstico semântico quando a referência cruzada não tem alvo', () => {
    const ast = documentoComFiguraEReferencia();
    const withBrokenReference: DocumentAst = {
      ...ast,
      document: {
        ...ast.document,
        children: ast.document.children.map((node) =>
          node.type === 'paragraph' && node.children.some((child) => child.id === asNodeId('xref-1'))
            ? {
                ...node,
                children: node.children.map((child) =>
                  child.id === asNodeId('xref-1')
                    ? {
                        ...child,
                        target: { kind: 'identifier' as const, identifier: 'fig:inexistente' },
                      }
                    : child,
                ),
              }
            : node,
        ),
      },
    };

    const resolved = resolverDocumento(withBrokenReference);
    expect(resolved.diagnostics.some((diagnostic) => diagnostic.id === 'XREF-NAO-RESOLVIDA')).toBe(true);
    expect(resolved.annotations.getString(asNodeId('xref-1'), TEXTO_DA_REFERENCIA_CRUZADA)).toBeUndefined();
  });
});

describe('M3 — catálogo ABNT', () => {
  it('combina regras ABNT versionadas com diagnósticos semânticos de referência ausente', () => {
    const report = validarArtigoAbnt(resolverDocumento(documentoComFiguraEReferencia()));
    const ids = report.diagnostics.map((diagnostic) => diagnostic.id);

    expect(ids).toContain('CIT-REF-AUSENTE');
    expect(ids).toContain('ABNT-10520-CIT-004');
    expect(ids).toContain('ABNT-6023-REF-001');
    expect(ids).toContain('ABNT-6022-FIG-001');
    expect(ids).toContain('ABNT-6022-FIG-002');
    expect(ids).toContain('ABNT-6028-RES-001');
    expect(report.normas.map((norma) => `${norma.id}@${norma.version}`)).toEqual(
      expect.arrayContaining([
        'abnt:nbr-10520@2023',
        'abnt:nbr-6023@2018',
        'abnt:nbr-6022@2018',
        'abnt:nbr-6028@2021',
      ]),
    );
  });
});

describe('F102 — APA 7', () => {
  it('publica citações autor-data e referências APA sem contaminar a AST', () => {
    const parsed = parseMarkdown('Pesquisa anterior [@fonte].', { documentId: 'apa.md' });
    const ast: DocumentAst = { ...parsed, references: { fonte: reference('fonte') } };
    const publication = compilarPublicacao(resolverDocumento(ast), perfilArtigoApa);
    const output = JSON.stringify(publication.documento);
    expect(output).toContain('(Silva, 2024)');
    expect(output).toContain('References');
    expect(output).toContain('Silva, A.');
  });
  it('valida os metadados essenciais sem reaplicar regras ABNT', () => {
    const parsed = parseMarkdown('Texto sem frontmatter.', { documentId: 'apa-incompleto.md' });
    const report = validarArtigoApa(resolverDocumento(parsed));
    expect(report.diagnostics.map((diagnostic) => diagnostic.id)).toEqual(expect.arrayContaining(['APA7-META-001', 'APA7-META-002']));
  });
});
