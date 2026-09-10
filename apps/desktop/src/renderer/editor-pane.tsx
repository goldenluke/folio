import { forwardRef, useEffect, useImperativeHandle, useRef, type DragEvent } from 'react';

import { CodeMirrorEditorAdapterService, type CodeMirrorEditorAdapter } from '@abnt/editor-codemirror';
import type { EditorController } from '@abnt/editor-core';
import type { LanguageLocation } from '@abnt/language-service';
import type { AcademicDesktopApi } from '../shared/api.js';

import { createRemoteLanguageService } from './remote-editor-controller.js';

export interface EditorPaneProps {
  readonly controller: EditorController;
  readonly api: AcademicDesktopApi;
  readonly onError: (message: string) => void;
  readonly onDefinition: (locations: readonly LanguageLocation[]) => void;
  readonly onReferences: (locations: readonly LanguageLocation[]) => void;
  readonly onContextMenu: (input: { readonly offset: number; readonly x: number; readonly y: number; readonly selection: { readonly anchor: number; readonly head: number } }) => void;
  readonly onAssetDropped: (uri: string, name: string) => void;
  readonly slashCommands: { readonly list: (query: string) => readonly { readonly id: string; readonly label: string }[]; readonly execute: (id: string) => void };
}

/** F326–F330 (find/replace): superfície imperativa mínima — só o que o host precisa acionar de fora do ciclo normal de props. */
export interface EditorPaneHandle {
  openSearchPanel(): void;
}

const imageMediaType = (file: File): string | undefined => {
  if (file.type.startsWith('image/')) return file.type;
  switch (file.name.split('.').pop()?.toLowerCase()) {
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    case 'svg': return 'image/svg+xml';
    default: return undefined;
  }
};

/**
 * Monta CodeMirror sobre um controller já existente. O controller é dono da
 * tab, não desta view: trocar de tab desmonta o adaptador (destroy) sem tocar
 * a sessão remota, seguindo o mesmo invariante de P7 (destruir a view não
 * destrói o documento).
 */
export const EditorPane = forwardRef<EditorPaneHandle, EditorPaneProps>(function EditorPane({ controller, api, onError, onDefinition, onReferences, onContextMenu, onAssetDropped, slashCommands }, handleRef) {
  const parent = useRef<HTMLDivElement>(null);
  const adapter = useRef<CodeMirrorEditorAdapter>(undefined);
  const callbacks = useRef({ onDefinition, onReferences, onContextMenu });
  callbacks.current = { onDefinition, onReferences, onContextMenu };

  useImperativeHandle(handleRef, () => ({
    openSearchPanel: () => adapter.current?.openSearchPanel(),
  }), []);

  useEffect(() => {
    if (parent.current === null) return undefined;
    const instance = CodeMirrorEditorAdapterService.create({
      controller,
      language: createRemoteLanguageService(api, (fileId) =>
        fileId === controller.fileId ? controller.snapshot().session.revision : undefined,
      ),
      parent: parent.current,
      onError: () => onError('Não foi possível aplicar a edição no vault.'),
      onDefinition: (locations) => callbacks.current.onDefinition(locations),
      onReferences: (locations) => callbacks.current.onReferences(locations),
      onContextMenu: (input) => callbacks.current.onContextMenu(input),
      slashCommands,
    });
    adapter.current = instance;
    instance.focus();
    return () => { adapter.current = undefined; instance.destroy(); };
  }, [api, controller]);

  const onDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault(); event.stopPropagation();
    const file = event.dataTransfer.files[0];
    const mediaType = file === undefined ? undefined : imageMediaType(file);
    if (file === undefined || mediaType === undefined) { onError('Arraste uma imagem para inserir como figura.'); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      const data = typeof reader.result === 'string' ? reader.result.split(',')[1] : undefined;
      if (data === undefined) { onError('Não foi possível ler a imagem.'); return; }
      const result = await api.editor.importAssetData({ sourceFileId: String(controller.fileId), name: file.name, mediaType, base64: data });
      if (!result.ok) { onError(result.error.message); return; }
      onAssetDropped(result.value.authoredUri, file.name);
    };
    reader.readAsDataURL(file);
  };

  return <div className="editor-pane min-h-0 min-w-0 flex-1 overflow-hidden" ref={parent} aria-label="Editor Markdown" onDragOverCapture={(event) => event.preventDefault()} onDropCapture={onDrop} />;
});
