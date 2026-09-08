import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { createCompilerMessagePortClient, serveWorkspaceOverMessagePort, type MessagePortLike } from '@abnt/protocol';

import { DesktopWorkspaceServiceHost } from './workspace-service.js';
import {
  NATIVE_MANIFEST_FILE,
  nativeManifestMismatch,
  type NativeAddonManifest,
} from './native-addon-manifest.js';

interface ParentPort {
  on(event: 'message', listener: (event: { readonly data?: unknown }) => void): void;
  off(event: 'message', listener: (event: { readonly data?: unknown }) => void): void;
  postMessage(value: unknown): void;
}

interface SqliteDatabase {
  close(): void;
}

interface SqliteDatabaseConstructor {
  new (filename: string, options: { readonly nativeBinding: string }): SqliteDatabase;
}

const runtimeDirectory = (): string => {
  const resourcesPath = (process as NodeJS.Process & { readonly resourcesPath?: string }).resourcesPath;
  const packaged = resourcesPath === undefined ? undefined : join(resourcesPath, 'workspace-runtime');
  return packaged !== undefined && existsSync(join(packaged, NATIVE_MANIFEST_FILE)) ? packaged : __dirname;
};

const workspaceRuntime = runtimeDirectory();
const debug = (message: string): void => {
  if (process.env.FOLIO_DEBUG_WORKSPACE === '1') console.error(`[workspace-entry] ${message}`);
};
debug(`runtime=${workspaceRuntime}`);
const workspaceRequire = createRequire(join(workspaceRuntime, 'package.json'));
const NativeDatabase = workspaceRequire('better-sqlite3') as SqliteDatabaseConstructor;
debug('better-sqlite3 carregado');

const parentPort = (process as NodeJS.Process & { readonly parentPort?: ParentPort }).parentPort;

/**
 * `better-sqlite3` procura seu addon via `bindings`, que no bundle CJS pode
 * resolver a pilha a partir de uma dependência externa. Inicializamos uma vez
 * com o addon privado do artefato para que a instância usada por
 * `workspace-index` reutilize o mesmo binding, compilado para o ABI Electron.
 */
const inicializarSqliteEmpacotado = (): void => {
  const addon = join(workspaceRuntime, 'node_modules/better-sqlite3/build/Release/better_sqlite3.node');
  debug(`validando addon=${addon}`);
  if (!existsSync(addon)) throw new Error('Binding SQLite do desktop não foi encontrado; execute o build do desktop.');
  const manifestPath = join(workspaceRuntime, NATIVE_MANIFEST_FILE);
  if (!existsSync(manifestPath)) {
    throw new Error('Manifesto do binding SQLite não foi encontrado; reconstrua o artefato desktop.');
  }
  let manifest: NativeAddonManifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as NativeAddonManifest;
  } catch {
    throw new Error('Manifesto do binding SQLite é inválido; reconstrua o artefato desktop.');
  }
  const mismatch = nativeManifestMismatch(manifest, {
    platform: process.platform,
    architecture: process.arch,
    electronVersion: process.versions.electron,
    electronModuleAbi: process.versions.modules,
  });
  if (mismatch !== undefined) {
    throw new Error(`Binding SQLite incompatível com este Electron: ${mismatch}. Reconstrua o artefato para este target.`);
  }
  debug('manifesto nativo compatível; abrindo SQLite de memória');
  const database = new NativeDatabase(':memory:', { nativeBinding: addon });
  debug('SQLite abriu; fechando');
  database.close();
  debug('SQLite inicializado');
};

if (parentPort === undefined) {
  throw new Error('O Workspace Service precisa ser iniciado por um host Electron utility process.');
}

inicializarSqliteEmpacotado();
debug('bootstrap do protocolo');

const processListeners = new Map<(value: unknown) => void, (event: { readonly data?: unknown }) => void>();
const workspacePort: MessagePortLike = {
  postMessage: (value) => parentPort.postMessage(value),
  on: (_event, listener) => {
    const wrapped = (event: { readonly data?: unknown }) => listener(event.data);
    processListeners.set(listener, wrapped);
    parentPort.on('message', wrapped);
  },
  off: (_event, listener) => {
    const wrapped = processListeners.get(listener);
    if (wrapped === undefined) return;
    processListeners.delete(listener);
    parentPort.off('message', wrapped);
  },
};

const compiler = createCompilerMessagePortClient(workspacePort);
const workspace = DesktopWorkspaceServiceHost.create({ compiler });
const unsubscribe = serveWorkspaceOverMessagePort(workspacePort, workspace);
const unsubscribeEvents = workspace.subscribe((desktopEvent) => {
  parentPort.postMessage({ type: 'abnt:desktop-event', event: desktopEvent });
});

process.once('disconnect', () => {
  unsubscribeEvents();
  unsubscribe();
  compiler.dispose();
  void workspace.dispose();
});
