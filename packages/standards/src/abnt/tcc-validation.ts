import { percorrer, type Diagnostic, type JsonValue } from '@abnt/document-model';
import type { ResolvedDocument } from '@abnt/semantics';

import { REGRAS_DO_ARTIGO_ABNT } from './validation.js';
import {
  palavrasDoResumo,
  validar,
  type RegraDeValidacao,
  type RelatorioDeValidacao,
} from '../validation.js';

const NBR_14724_2011 = { id: 'abnt:nbr-14724', version: '2011' } as const;
const NBR_6028_2021 = { id: 'abnt:nbr-6028', version: '2021' } as const;

const property = (doc: ResolvedDocument, key: string): JsonValue | undefined =>
  doc.ast.document.metadata.properties?.[key];

const hasText = (value: JsonValue | undefined): boolean =>
  (typeof value === 'string' && value.trim() !== '') || typeof value === 'number';

const documentDiagnostic = (id: string, message: string): Diagnostic => ({
  id,
  severity: 'error',
  message,
});

const estruturaObrigatoria: RegraDeValidacao = {
  id: 'ABNT-14724-EST-001',
  norma: NBR_14724_2011,
  validar: ({ document }) => {
    const metadata = document.ast.document.metadata;
    const diagnostics: Diagnostic[] = [];
    if (metadata.title === undefined || metadata.title.length === 0) {
      diagnostics.push(documentDiagnostic('ABNT-14724-EST-001', 'Trabalho sem título. NBR 14724:2011, seção 4.'));
    }
    const contributors = metadata.contributors ?? [];
    if (!contributors.some((item) => item.role === 'author')) {
      diagnostics.push(documentDiagnostic('ABNT-14724-EST-002', 'Trabalho sem autoria declarada. NBR 14724:2011, seção 4.'));
    }
    if (!contributors.some((item) => item.role === 'advisor')) {
      diagnostics.push(documentDiagnostic('ABNT-14724-EST-003', 'Trabalho sem orientador declarado. NBR 14724:2011, seção 4.'));
    }
    const required = [
      ['tcc:institution', 'ABNT-14724-EST-004', 'Instituição não informada.'],
      ['tcc:nature', 'ABNT-14724-EST-005', 'Natureza e objetivo do trabalho não informados.'],
      ['tcc:place', 'ABNT-14724-EST-006', 'Local de apresentação não informado.'],
      ['tcc:year', 'ABNT-14724-EST-007', 'Ano de apresentação não informado.'],
      ['tcc:approval-date', 'ABNT-14724-EST-008', 'Data de aprovação não informada.'],
      ['tcc:catalog-card', 'ABNT-14724-EST-009', 'Ficha catalográfica não informada.'],
    ] as const;
    for (const [key, id, message] of required) {
      if (!hasText(property(document, key))) {
        diagnostics.push(documentDiagnostic(id, `${message} NBR 14724:2011, seção 4.`));
      }
    }
    return diagnostics;
  },
};

const resumosObrigatorios: RegraDeValidacao = {
  id: 'ABNT-6028-TCC-001',
  norma: NBR_6028_2021,
  validar: ({ document }) => {
    const diagnostics: Diagnostic[] = [];
    const pt = palavrasDoResumo(document.ast);
    if (pt < 150 || pt > 500) {
      diagnostics.push(
        documentDiagnostic(
          'ABNT-6028-TCC-001',
          `Resumo em português com ${pt} palavras; o profile de TCC aceita de 150 a 500. NBR 6028:2021, seção 4.`,
        ),
      );
    }
    const english = property(document, 'tcc:abstract-en');
    const count = typeof english === 'string' && english.trim() !== ''
      ? english.trim().split(/\s+/u).length
      : 0;
    if (count < 150 || count > 500) {
      diagnostics.push(
        documentDiagnostic(
          'ABNT-6028-TCC-002',
          `Resumo em língua estrangeira com ${count} palavras; o profile de TCC aceita de 150 a 500. NBR 6028:2021, seção 4.`,
        ),
      );
    }
    if ((document.ast.document.metadata.keywords ?? []).length === 0) {
      diagnostics.push(documentDiagnostic('ABNT-6028-TCC-003', 'Palavras-chave em português não informadas. NBR 6028:2021, seção 4.'));
    }
    const keywords = property(document, 'tcc:keywords-en');
    if (!Array.isArray(keywords) || !keywords.some((item) => typeof item === 'string' && item.trim() !== '')) {
      diagnostics.push(documentDiagnostic('ABNT-6028-TCC-004', 'Palavras-chave em língua estrangeira não informadas. NBR 6028:2021, seção 4.'));
    }
    return diagnostics;
  },
};

const elementosIlustrativos: RegraDeValidacao = {
  id: 'ABNT-14724-ELM-001',
  norma: NBR_14724_2011,
  validar: ({ document }) => {
    const diagnostics: Diagnostic[] = [];
    for (const node of percorrer(document.ast)) {
      if (node.type !== 'figure' && node.type !== 'table') continue;
      const label = node.type === 'figure' ? 'Figura' : 'Tabela';
      const code = node.type === 'figure' ? 'FIG' : 'TAB';
      if (node.caption?.short === undefined || node.caption.short.length === 0) {
        diagnostics.push({
          id: `ABNT-14724-${code}-001`,
          severity: 'error',
          message: `${label} sem título. NBR 14724:2011, seção 5.`,
          nodeId: node.id,
          ...(node.source !== undefined ? { source: node.source } : {}),
        });
      }
      const source = node.attribution;
      const hasSource =
        (source?.content !== undefined && source.content.length > 0) ||
        (source?.citations !== undefined && source.citations.length > 0);
      if (!hasSource) {
        diagnostics.push({
          id: `ABNT-14724-${code}-002`,
          severity: 'error',
          message: `${label} sem indicação de fonte. NBR 14724:2011, seção 5.`,
          nodeId: node.id,
          ...(node.source !== undefined ? { source: node.source } : {}),
        });
      }
    }
    return diagnostics;
  },
};

const regrasComuns = REGRAS_DO_ARTIGO_ABNT.filter(
  (rule) => rule.norma.id === 'abnt:nbr-10520' || rule.norma.id === 'abnt:nbr-6023',
);

export const REGRAS_DO_TCC_ABNT: readonly RegraDeValidacao[] = [
  ...regrasComuns,
  estruturaObrigatoria,
  resumosObrigatorios,
  elementosIlustrativos,
];

export function validarTccAbnt(document: ResolvedDocument): RelatorioDeValidacao {
  const report = validar(REGRAS_DO_TCC_ABNT, { document });
  const semantic = document.diagnostics;
  return {
    ...report,
    diagnostics: [...semantic, ...report.diagnostics],
    errors: report.errors + semantic.filter((item) => item.severity === 'error').length,
    warnings: report.warnings + semantic.filter((item) => item.severity === 'warning').length,
  };
}
