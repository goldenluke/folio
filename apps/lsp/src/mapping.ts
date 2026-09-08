import { CompletionItemKind, DiagnosticSeverity, SymbolKind } from 'vscode-languageserver';

import type { LanguageCompletionKind, LanguageDiagnostic } from '@abnt/language-service';

/** Tradução pura de enums — sem I/O, sem posição, testável isoladamente. */
export const severityToLsp = (severity: LanguageDiagnostic['severity']): DiagnosticSeverity => {
  switch (severity) {
    case 'error':
      return DiagnosticSeverity.Error;
    case 'warning':
      return DiagnosticSeverity.Warning;
    case 'info':
      return DiagnosticSeverity.Information;
  }
};

export const completionKindToLsp = (kind: LanguageCompletionKind): CompletionItemKind =>
  kind === 'citation' ? CompletionItemKind.Reference : CompletionItemKind.File;

/** Cabeçalhos não têm SymbolKind próprio no LSP; String é a convenção usada por outros LSPs de Markdown. */
export const OUTLINE_SYMBOL_KIND = SymbolKind.String;
