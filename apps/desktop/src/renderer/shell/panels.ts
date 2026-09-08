import type { JSX } from 'react';

import type { EditorViewState } from './views.js';

/**
 * Painéis do lado direito são registráveis, não hardcoded no layout — é o que
 * permitiu adicionar Backlinks em P11 sem reabrir o layout do shell. O
 * componente recebe a view ativa; se quiser dados que a sessão não carrega
 * (backlinks, grafo), busca pela API do preload, nunca por parse local.
 *
 * `render` é invocado como componente React (via JSX, não chamada direta) —
 * pode usar hooks para buscar dados assíncronos, como o painel de Backlinks.
 * Restrito a `EditorViewState`: outline/diagnósticos/backlinks só existem
 * para um documento sendo editado. Uma tab de preview ativa passa `view: undefined`.
 */
export interface PanelRenderProps {
  readonly view: EditorViewState | undefined;
  readonly openDocument: (fileId: string, path: string) => void;
  /** Insere `[@id]` na posição atual do editor ativo via comando — nunca toca CodeMirror direto. */
  readonly insertCitation: (id: string) => void;
  /** F34: cria (ou reabre) a literature note da referência, via comando. */
  readonly createLiteratureNote: (referenceId: string) => void;
  /** F32: transforma uma menção não linkada sugerida num link real, via comando. */
  readonly linkifyMention: (mention: {
    readonly range: { readonly start: number; readonly end: number };
    readonly text: string;
    readonly targetPath: string;
  }) => void;
  readonly moveOutlineSection: (offset: number, direction: 'up' | 'down') => void;
  /** Renomeia o heading por uma transação revisionada da autoridade do workspace. */
  readonly renameOutlineSection: (offset: number, title: string) => void;
}

export interface PanelDefinition {
  readonly id: string;
  readonly title: string;
  render(props: PanelRenderProps): JSX.Element;
}

export interface PanelRegistry {
  register(panel: PanelDefinition): () => void;
  list(): readonly PanelDefinition[];
}

export function createPanelRegistry(): PanelRegistry {
  const panels: PanelDefinition[] = [];
  return {
    register(panel) {
      if (panels.some((existing) => existing.id === panel.id)) {
        throw new Error(`Painel duplicado: ${panel.id}`);
      }
      panels.push(panel);
      return () => {
        const index = panels.indexOf(panel);
        if (index !== -1) panels.splice(index, 1);
      };
    },
    list() {
      return panels;
    },
  };
}
