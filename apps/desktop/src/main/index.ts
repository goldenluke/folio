import { app, BrowserWindow, Menu, session } from 'electron';
import { writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { WorkspaceBrowserCaptureDto } from '@abnt/protocol';

import { registerDesktopIpc } from './ipc.js';
import { loadSystemInformation } from './build-information.js';
import { CompilerSupervisor } from './compiler-supervisor.js';
import { ExportSupervisor } from './export-supervisor.js';
import { WorkspaceSupervisor } from './workspace-supervisor.js';
import { startBrowserBridge } from './browser-bridge.js';

let disposeIpc: (() => void) | undefined;
let disposeBrowserBridge: (() => void) | undefined;

// Marca apresentada pelo processo Electron no ambiente desktop. Os namespaces
// internos @abnt/* continuam sendo identificadores de implementação.
app.setName('Folio');

const asset = (...segments: readonly string[]): string => join(__dirname, '..', ...segments);
/**
 * O bundle do Workspace Service é autocontido, exceto por better-sqlite3.
 * No package ele roda ao lado do binding P18 em `resources`, fora do ASAR;
 * assim toda resolução de `require('better-sqlite3')` encontra essa única
 * cópia, compilada para o Electron distribuído.
 */
const workspaceEntry = (): string => {
  const packaged = join(process.resourcesPath, 'workspace-runtime', 'index.cjs');
  return existsSync(packaged) ? packaged : asset('workspace', 'index.cjs');
};

const sendOperationalError = (operation: string, message: string): void => {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('abnt:desktop:event', {
      type: 'desktop:operational-error',
      operation,
      error: { code: 'INTERNAL', message },
    });
  }
};

const sendBrowserCapture = (capture: WorkspaceBrowserCaptureDto): void => {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('abnt:desktop:event', { type: 'desktop:browser-capture', capture });
  }
};

const compiler = new CompilerSupervisor(asset('compiler-service', 'index.cjs'));
const workspace = new WorkspaceSupervisor(workspaceEntry(), compiler);
const exportService = new ExportSupervisor(asset('export-service', 'index.cjs'));

const createWindow = async (): Promise<void> => {
  const window = new BrowserWindow({
    title: 'Folio',
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: asset('preload', 'index.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file:')) event.preventDefault();
  });
  await window.loadFile(asset('renderer', 'index.html'));
};

app.whenReady().then(async () => {
  /**
   * Sem isto, o Electron cria o menu padrão da plataforma, cujos itens
   * Undo/Redo do menu Edit usam `role: 'undo'`/`'redo'` — undo/redo nativo do
   * Chromium, que não sabe nada do histórico próprio do CodeMirror. O
   * acelerador Mod+Z/Mod+Shift+Z do menu intercepta a tecla antes dela virar
   * um keydown no DOM, então `historyKeymap` do editor nunca chega a rodar:
   * undo/redo parecem simplesmente não fazer nada. O shell inteiro (paleta de
   * comandos, atalhos, toolbar) já é autoral deste app; o menu nativo nunca
   * foi usado para nada aqui além disso — em build empacotado ele some por
   * completo, em desenvolvimento sobra só Reload/DevTools.
   */
  Menu.setApplicationMenu(app.isPackaged ? null : Menu.buildFromTemplate([
    { label: 'Desenvolvedor', submenu: [{ role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' }] },
  ]));
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
        ],
      },
    });
  });
  compiler.subscribe((status) => {
    if (status.type === 'compiler:exited') {
      workspace.dispose();
      sendOperationalError('compiler', 'O serviço de compilação foi reiniciado; reabra o vault.');
    }
  });
  workspace.subscribeStatus((status) => {
    if (status.type === 'workspace:exited') sendOperationalError('workspace', 'O serviço do vault foi encerrado; reabra o vault.');
  });
  exportService.subscribe((status) => {
    if (status.type === 'export:exited') sendOperationalError('export', 'O serviço de exportação foi reiniciado; tente exportar de novo.');
  });
  const systemInformation = await loadSystemInformation(asset('build-info.json'));
  disposeIpc = registerDesktopIpc(workspace, exportService, systemInformation, createWindow);
  try {
    disposeBrowserBridge = await startBrowserBridge(sendBrowserCapture);
  } catch {
    // A porta pode estar ocupada por outra instância; o desktop continua útil.
    sendOperationalError('browser-bridge', 'A ponte do navegador não pôde iniciar nesta instância.');
  }
  await createWindow();
  const smokeVault = process.env.ABNT_DESKTOP_SMOKE_VAULT;
  if (smokeVault !== undefined) {
    const smokeExportPath = process.env.ABNT_DESKTOP_SMOKE_EXPORT_PATH;
    const smokeDocxPath = process.env.ABNT_DESKTOP_SMOKE_DOCX_PATH;
    const packageSmoke = process.env.ABNT_DESKTOP_SMOKE_PACKAGE === '1';
    const client = workspace.client();
    const result = await client.open({ rootPath: smokeVault });
    let editorResult: unknown;
    let editResult: unknown;
    let saveResult: unknown;
    let reopenResult: unknown;
    let searchResult: unknown;
    let previewResult: unknown;
    let exportResult: unknown;
    let docxResult: unknown;
    let smokeFileId: string | undefined;
    if (result.ok) {
      const markdown = result.value.files.find((file) => file.mediaType === 'text/markdown' && file.path !== 'README.md');
      if (markdown !== undefined) {
        smokeFileId = markdown.fileId;
        const openedEditor = await client.openEditor({ fileId: markdown.fileId });
        editorResult = openedEditor;
        if (packageSmoke && openedEditor.ok) {
          const offset = openedEditor.value.session.content.length;
          const edited = await client.dispatchEditor({
            fileId: markdown.fileId,
            expectedRevision: openedEditor.value.session.revision,
            transaction: {
              edits: [{ range: { start: offset, end: offset }, text: '\n\nFolio packaged smoke persisted.\n' }],
            },
          });
          editResult = edited;
          if (edited.ok) {
            const saved = await client.saveEditor({ fileId: markdown.fileId, expectedRevision: edited.value.session.revision });
            saveResult = saved;
            if (saved.ok) {
              await client.closeEditor({ fileId: markdown.fileId });
              reopenResult = await client.openEditor({ fileId: markdown.fileId });
            }
          }
        }
        for (let attempt = 0; attempt < 100; attempt += 1) {
          const search = await client.search({ query: 'Folio', limit: 5 });
          if (!search.ok || search.value.some((candidate) => candidate.fileId === markdown.fileId)) {
            searchResult = search;
            break;
          }
          await new Promise<void>((resolve) => setTimeout(resolve, 50));
        }
        for (let attempt = 0; attempt < 100; attempt += 1) {
          const preview = await client.previewEditor({ fileId: markdown.fileId });
          if (!preview.ok || preview.value !== undefined) {
            previewResult = preview;
            break;
          }
          await new Promise<void>((resolve) => setTimeout(resolve, 50));
        }
        if (smokeExportPath !== undefined) {
          const publication = await client.exportDocument({ fileId: markdown.fileId });
          if (!publication.ok || publication.value === undefined) {
            exportResult = publication;
          } else {
            const generated = await exportService.client().export({
              publication: publication.value.publication,
              format: 'pdf',
            });
            exportResult = generated;
            if (generated.ok) await writeFile(smokeExportPath, generated.value.bytes);
          }
        }
        if (smokeDocxPath !== undefined) {
          const publication = await client.exportDocument({ fileId: markdown.fileId });
          if (!publication.ok || publication.value === undefined) {
            docxResult = publication;
          } else {
            const generated = await exportService.client().export({
              publication: publication.value.publication,
              format: 'docx',
            });
            docxResult = generated;
            if (generated.ok) await writeFile(smokeDocxPath, generated.value.bytes);
          }
        }
      }
    }
    const editorOk =
      typeof editorResult === 'object' &&
      editorResult !== null &&
      'ok' in editorResult &&
      editorResult.ok === true;
    const previewOk =
      typeof previewResult === 'object' &&
      previewResult !== null &&
      'ok' in previewResult &&
      previewResult.ok === true &&
      'value' in previewResult &&
      previewResult.value !== undefined;
    const searchOk =
      typeof searchResult === 'object' &&
      searchResult !== null &&
      'ok' in searchResult &&
      searchResult.ok === true &&
      'value' in searchResult &&
      Array.isArray(searchResult.value) &&
      searchResult.value.some((candidate) => candidate.fileId === smokeFileId);
    const editOk =
      !packageSmoke ||
      (typeof editResult === 'object' && editResult !== null && 'ok' in editResult && editResult.ok === true);
    const saveOk =
      !packageSmoke ||
      (typeof saveResult === 'object' && saveResult !== null && 'ok' in saveResult && saveResult.ok === true);
    const reopenOk =
      !packageSmoke ||
      (typeof reopenResult === 'object' &&
        reopenResult !== null &&
        'ok' in reopenResult &&
        reopenResult.ok === true &&
        'value' in reopenResult &&
        typeof reopenResult.value === 'object' &&
        reopenResult.value !== null &&
        'session' in reopenResult.value &&
        typeof reopenResult.value.session === 'object' &&
        reopenResult.value.session !== null &&
        'content' in reopenResult.value.session &&
        typeof reopenResult.value.session.content === 'string' &&
        reopenResult.value.session.content.includes('Folio packaged smoke persisted.'));
    const exportOk =
      smokeExportPath === undefined ||
      (typeof exportResult === 'object' &&
        exportResult !== null &&
        'ok' in exportResult &&
        exportResult.ok === true);
    const docxOk =
      smokeDocxPath === undefined ||
      (typeof docxResult === 'object' && docxResult !== null && 'ok' in docxResult && docxResult.ok === true);
    const smokeOk = result.ok && editorOk && searchOk && previewOk && exportOk && docxOk && editOk && saveOk && reopenOk;
    console.log(
      `[folio-desktop-smoke] ${JSON.stringify({
        ok: smokeOk,
        workspace: result.ok,
        editor: editorOk,
        search: searchOk,
        preview: previewOk,
        ...(packageSmoke ? { edit: editOk, save: saveOk, reopen: reopenOk } : {}),
        ...(smokeExportPath !== undefined ? { export: exportOk } : {}),
        ...(smokeDocxPath !== undefined ? { docx: docxOk } : {}),
      })}`,
    );
    if (!smokeOk) process.exitCode = 1;
    app.quit();
    return;
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  disposeIpc?.();
  disposeBrowserBridge?.();
  workspace.dispose();
  compiler.dispose();
  exportService.dispose();
});
