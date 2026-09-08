import { importarBibtex, importarCslJson, importarRis } from '@abnt/bibliography';
import type { BibliographicEntity, Diagnostic, Registry } from '@abnt/document-model';

export type LibraryTransferFormat = 'bibtex' | 'ris' | 'csl-json';

export interface ImportedLibraryContent {
  readonly entries: Registry<BibliographicEntity>;
  readonly diagnostics: readonly Pick<Diagnostic, 'id' | 'severity' | 'message'>[];
}

/** Adapter de importação: formatos de terceiros convergem antes no CSL interno. */
export function importLibraryContent(format: LibraryTransferFormat, content: string): ImportedLibraryContent {
  switch (format) {
    case 'bibtex': { const result = importarBibtex(content); return { entries: result.references, diagnostics: result.diagnostics }; }
    case 'ris': { const result = importarRis(content); return { entries: result.references, diagnostics: result.diagnostics }; }
    case 'csl-json': { const result = importarCslJson(content); return { entries: result.references, diagnostics: result.diagnostics }; }
  }
}
