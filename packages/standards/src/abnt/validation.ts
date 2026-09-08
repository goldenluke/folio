import type { Diagnostic } from '@abnt/document-model';

import {
  nodesDoDocumento,
  palavrasDoResumo,
  validar,
  type ContextoDeValidacao,
  type RegraDeValidacao,
  type RelatorioDeValidacao,
} from '../validation.js';

const NBR_6022_2018 = { id: 'abnt:nbr-6022', version: '2018' } as const;
const NBR_6023_2018 = { id: 'abnt:nbr-6023', version: '2018' } as const;
const NBR_6028_2021 = { id: 'abnt:nbr-6028', version: '2021' } as const;
const NBR_10520_2023 = { id: 'abnt:nbr-10520', version: '2023' } as const;

const diagnosticoDoNo = (
  id: string,
  message: string,
  node: import('@abnt/document-model').AnyNode,
): Diagnostic => ({
  id,
  severity: 'error',
  message,
  nodeId: node.id,
  ...(node.source !== undefined ? { source: node.source } : {}),
});

/** Quote com fonte explícita é citação direta e precisa do respectivo localizador. */
const citacaoDiretaComLocalizador: RegraDeValidacao = {
  id: 'ABNT-10520-CIT-004',
  norma: NBR_10520_2023,
  validar: ({ document }) =>
    nodesDoDocumento(document.ast)
      .filter((node): node is import('@abnt/document-model').QuoteNode => node.type === 'quote')
      .flatMap((quote) =>
        (quote.attribution?.citations ?? [])
          .filter((citation) => citation.locator === undefined)
          .map(() =>
            diagnosticoDoNo(
              'ABNT-10520-CIT-004',
              'Citação direta sem indicação de localização da fonte. NBR 10520:2023, seção 6.1.',
              quote,
            ),
          ),
      ),
};

const referenciasNaoCitadas: RegraDeValidacao = {
  id: 'ABNT-6023-REF-001',
  norma: NBR_6023_2018,
  validar: ({ document }) => {
    const cited = new Set(document.citations.citedReferenceIds);
    return Object.values(document.bibliography)
      .filter((reference) => !cited.has(reference.id))
      .map((reference) => ({
        id: 'ABNT-6023-REF-001',
        severity: 'warning' as const,
        message: `A referência "${reference.id}" não é citada no documento. NBR 6023:2018.`,
      }));
  },
};

const figurasCompletas: RegraDeValidacao = {
  id: 'ABNT-6022-FIG-001',
  norma: NBR_6022_2018,
  validar: ({ document }) => {
    const diagnostics: Diagnostic[] = [];
    for (const node of nodesDoDocumento(document.ast)) {
      if (node.type !== 'figure') continue;
      if (node.caption?.short === undefined || node.caption.short.length === 0) {
        diagnostics.push(
          diagnosticoDoNo(
            'ABNT-6022-FIG-001',
            'Figura sem legenda. NBR 6022:2018.',
            node,
          ),
        );
      }
      const attribution = node.attribution;
      const hasSource =
        (attribution?.content !== undefined && attribution.content.length > 0) ||
        (attribution?.citations !== undefined && attribution.citations.length > 0);
      if (!hasSource) {
        diagnostics.push(
          diagnosticoDoNo(
            'ABNT-6022-FIG-002',
            'Figura sem indicação de fonte. NBR 6022:2018.',
            node,
          ),
        );
      }
    }
    return diagnostics;
  },
};

const tabelasCompletas: RegraDeValidacao = {
  id: 'ABNT-6022-TAB-001',
  norma: NBR_6022_2018,
  validar: ({ document }) => {
    const diagnostics: Diagnostic[] = [];
    for (const node of nodesDoDocumento(document.ast)) {
      if (node.type !== 'table') continue;
      if (node.caption?.short === undefined || node.caption.short.length === 0) {
        diagnostics.push(
          diagnosticoDoNo('ABNT-6022-TAB-001', 'Tabela sem título. NBR 6022:2018.', node),
        );
      }
      const attribution = node.attribution;
      const hasSource =
        (attribution?.content !== undefined && attribution.content.length > 0) ||
        (attribution?.citations !== undefined && attribution.citations.length > 0);
      if (!hasSource) {
        diagnostics.push(
          diagnosticoDoNo('ABNT-6022-TAB-002', 'Tabela sem indicação de fonte. NBR 6022:2018.', node),
        );
      }
    }
    return diagnostics;
  },
};

export interface LimitesDoResumo {
  readonly minWords: number;
  readonly maxWords: number;
}

/** Perfil de artigo: faixa configurável para não confundir regra e template. */
export const LIMITES_PADRAO_DO_RESUMO_DE_ARTIGO: LimitesDoResumo = {
  minWords: 100,
  maxWords: 250,
};

export const regraDoResumo = (limits: LimitesDoResumo): RegraDeValidacao => ({
  id: 'ABNT-6028-RES-001',
  norma: NBR_6028_2021,
  validar: ({ document }) => {
    const count = palavrasDoResumo(document.ast);
    if (count >= limits.minWords && count <= limits.maxWords) return [];
    return [
      {
        id: 'ABNT-6028-RES-001',
        severity: 'error',
        message: `Resumo com ${count} palavras; o profile de artigo aceita de ${limits.minWords} a ${limits.maxWords}. NBR 6028:2021.`,
        nodeId: document.ast.document.id,
        ...(document.ast.document.source !== undefined
          ? { source: document.ast.document.source }
          : {}),
      },
    ];
  },
});

export const REGRAS_DO_ARTIGO_ABNT: readonly RegraDeValidacao[] = [
  citacaoDiretaComLocalizador,
  referenciasNaoCitadas,
  figurasCompletas,
  tabelasCompletas,
  regraDoResumo(LIMITES_PADRAO_DO_RESUMO_DE_ARTIGO),
];

/** Inclui semântica genérica (p.ex. chave de citação ausente) e regras ABNT. */
export function validarArtigoAbnt(
  document: ContextoDeValidacao['document'],
): RelatorioDeValidacao {
  const report = validar(REGRAS_DO_ARTIGO_ABNT, { document });
  const semanticDiagnostics = document.diagnostics;
  return {
    ...report,
    diagnostics: [...semanticDiagnostics, ...report.diagnostics],
    errors:
      report.errors + semanticDiagnostics.filter((diagnostic) => diagnostic.severity === 'error').length,
    warnings:
      report.warnings + semanticDiagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length,
  };
}
