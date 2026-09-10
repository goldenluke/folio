import type { Diagnostic } from '@abnt/document-model';
import { palavrasDoResumo, validar, type ContextoDeValidacao, type RegraDeValidacao, type RelatorioDeValidacao } from '../validation.js';

/** Referência pública da edição; as regras são codificadas, não reproduzem o manual. */
const APA_7 = { id: 'apa:publication-manual', version: '7' } as const;
const documentDiagnostic = (id: string, message: string, context: ContextoDeValidacao): Diagnostic => ({ id, severity: 'error', message, nodeId: context.document.ast.document.id, ...(context.document.ast.document.source === undefined ? {} : { source: context.document.ast.document.source }) });

const metadataEssencial: RegraDeValidacao = { id: 'APA7-META-001', norma: APA_7, validar: (context) => {
  const metadata = context.document.ast.document.metadata; const diagnostics: Diagnostic[] = [];
  if (metadata.title === undefined || metadata.title.length === 0) diagnostics.push(documentDiagnostic('APA7-META-001', 'O profile APA 7 requer título.', context));
  if ((metadata.contributors ?? []).length === 0) diagnostics.push(documentDiagnostic('APA7-META-002', 'O profile APA 7 requer pelo menos uma autoria.', context));
  return diagnostics;
} };
const abstractWhenPresent: RegraDeValidacao = { id: 'APA7-ABS-001', norma: APA_7, validar: (context) => {
  const count = palavrasDoResumo(context.document.ast); return count === 0 ? [] : count > 250 ? [documentDiagnostic('APA7-ABS-001', `Abstract com ${count} palavras; o recorte APA 7 do Folio aceita no máximo 250.`, context)] : [];
} };
const identifierQuality: RegraDeValidacao = { id: 'APA7-REF-001', norma: APA_7, validar: ({ document }) => Object.values(document.bibliography).flatMap((reference) => {
  if (reference.DOI !== undefined && !/^(?:https?:\/\/doi\.org\/)?10\.\S+$/iu.test(reference.DOI)) return [{ id: 'APA7-REF-001', severity: 'warning' as const, message: `DOI da referência "${reference.id}" não parece um identificador DOI utilizável.` }];
  return [];
}) };
export const REGRAS_DO_ARTIGO_APA: readonly RegraDeValidacao[] = [metadataEssencial, abstractWhenPresent, identifierQuality];
export function validarArtigoApa(document: ContextoDeValidacao['document']): RelatorioDeValidacao { const report = validar(REGRAS_DO_ARTIGO_APA, { document }); const semantic = document.diagnostics; return { ...report, diagnostics: [...semantic, ...report.diagnostics], errors: report.errors + semantic.filter((diagnostic) => diagnostic.severity === 'error').length, warnings: report.warnings + semantic.filter((diagnostic) => diagnostic.severity === 'warning').length }; }
