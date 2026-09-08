import { useEffect, useRef, type JSX } from 'react';

import { CodeMirrorEditorAdapterService } from '@abnt/editor-codemirror';
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
  readonly onCitationClick: (offset: number) => void;
  readonly onAssetDropped: (uri: string, name: string) => void;
}

/**
 * Monta CodeMirror sobre um controller já existente. O controller é dono da
 * tab, não desta view: trocar de tab desmonta o adaptador (destroy) sem tocar
 * a sessão remota, seguindo o mesmo invariante de P7 (destruir a view não
 * destrói o documento).
 */
export function EditorPane({ controller, api, onError, onDefinition, onReferences, onCitationClick, onAssetDropped }: EditorPaneProps): JSX.Element {
  const parent = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onDefinition, onReferences, onCitationClick });
  callbacks.current = { onDefinition, onReferences, onCitationClick };

  useEffect(() => {
    if (parent.current === null) return undefined;
    const adapter = CodeMirrorEditorAdapterService.create({
      controller,
      language: createRemoteLanguageService(api, (fileId) =>
        fileId === controller.fileId ? controller.snapshot().session.revision : undefined,
      ),
      parent: parent.current,
      onError: () => onError('Não foi possível aplicar a edição no vault.'),
      onDefinition: (locations) => callbacks.current.onDefinition(locations),
      onReferences: (locations) => callbacks.current.onReferences(locations),
      onCitationClick: (offset) => callbacks.current.onCitationClick(offset),
    });
    adapter.focus();
    return () => adapter.destroy();
  }, [api, controller]);

  return <div className="editor-pane min-h-0 min-w-0 flex-1 overflow-hidden" ref={parent} aria-label="Editor Markdown" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file=event.dataTransfer.files[0]; if(file===undefined||!file.type.startsWith('image/')) { onError('Arraste uma imagem para inserir como figura.'); return; } const reader=new FileReader(); reader.onload=async()=>{const data=typeof reader.result==='string'?reader.result.split(',')[1]:undefined; if(data===undefined){onError('Não foi possível ler a imagem.');return;} const result=await api.editor.importAssetData({sourceFileId:String(controller.fileId),name:file.name,mediaType:file.type,base64:data}); if(!result.ok){onError(result.error.message);return;} onAssetDropped(result.value.authoredUri,file.name);}; reader.readAsDataURL(file); }} />;
}
