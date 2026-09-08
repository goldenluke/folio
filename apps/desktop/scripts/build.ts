import { build as esbuild } from 'esbuild';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, copyFile, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build as viteBuild } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PLUGIN_PROTOCOL_VERSION } from '@abnt/plugin-api';
import { PROTOCOL_VERSION } from '@abnt/protocol';
import {
  WORKSPACE_CONFIGURATION_SCHEMA_VERSION,
  WORKSPACE_STATE_SCHEMA_VERSION,
} from '@abnt/workspace-core';
import { WORKSPACE_INDEX_SCHEMA_VERSION } from '@abnt/workspace-index';

import {
  NATIVE_MANIFEST_FILE,
  createNativeAddonManifest,
  nativeTargetId,
  type NativeAddonManifest,
} from '../src/workspace/native-addon-manifest.ts';
import {
  BUILD_INFORMATION_FILE,
  buildChannelFromEnvironment,
  createBuildInformation,
} from '../src/shared/build-information.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(root, '../..');
const output = resolve(root, 'dist');
const nativeCache = resolve(root, '.native-cache');
const require = createRequire(import.meta.url);

const desktopPackage = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')) as { readonly version: string };
const buildInformation = createBuildInformation({
  appVersion: desktopPackage.version,
  commit: process.env.FOLIO_GIT_COMMIT?.trim() || process.env.GITHUB_SHA?.trim() || 'unavailable',
  channel: buildChannelFromEnvironment(process.env.FOLIO_BUILD_CHANNEL),
  platform: process.platform,
  architecture: process.arch,
  electronVersion: require('electron/package.json').version as string,
  protocolVersion: PROTOCOL_VERSION,
  workspaceConfigSchemaVersion: WORKSPACE_CONFIGURATION_SCHEMA_VERSION,
  workspaceStateSchemaVersion: WORKSPACE_STATE_SCHEMA_VERSION,
  workspaceIndexSchemaVersion: WORKSPACE_INDEX_SCHEMA_VERSION,
  pluginApiVersion: PLUGIN_PROTOCOL_VERSION,
});

/**
 * O serviço do workspace é executado pelo runtime do Electron, cujo ABI não é
 * o mesmo do Node que roda os testes. Mantemos um binding nativo privado no
 * artefato desktop para não recompilear a cópia do store pnpm e quebrar a CLI.
 */
const prepararSqliteDoElectron = async (): Promise<void> => {
  const packageJson = require.resolve('better-sqlite3/package.json');
  const source = dirname(packageJson);
  const workspaceOutput = resolve(output, 'workspace');
  const destination = resolve(workspaceOutput, 'node_modules/better-sqlite3');
  const sqliteRequire = createRequire(packageJson);
  const bindingsPackageJson = sqliteRequire.resolve('bindings/package.json');
  const bindingsRequire = createRequire(bindingsPackageJson);
  const fileUriPackageJson = bindingsRequire.resolve('file-uri-to-path/package.json');
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(
    resolve(workspaceOutput, 'package.json'),
    JSON.stringify({
      name: '@abnt/desktop-workspace-runtime',
      private: true,
      dependencies: { 'better-sqlite3': '^12.11.1', bindings: '^1.5.0', 'file-uri-to-path': '1.0.0' },
    }),
  );
  await cp(source, destination, { recursive: true, force: true });
  await rm(resolve(destination, 'build'), { recursive: true, force: true });
  await cp(dirname(bindingsPackageJson), resolve(workspaceOutput, 'node_modules/bindings'), { recursive: true, force: true });
  await cp(dirname(fileUriPackageJson), resolve(workspaceOutput, 'node_modules/file-uri-to-path'), { recursive: true, force: true });
};

const executar = async (command: string, args: readonly string[]): Promise<void> => {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(command, [...args], { stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} terminou com código ${code ?? 'desconhecido'}.`));
    });
  });
};

const executarEColetar = async (command: string, args: readonly string[], environment: NodeJS.ProcessEnv = process.env): Promise<string> => {
  return new Promise<string>((resolvePromise, reject) => {
    const child = spawn(command, [...args], { stdio: ['ignore', 'pipe', 'inherit'], env: environment });
    let output = '';
    child.stdout.on('data', (chunk) => { output += String(chunk); });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolvePromise(output.trim());
      else reject(new Error(`${command} terminou com código ${code ?? 'desconhecido'}.`));
    });
  });
};

const esperarArquivo = async (path: string, timeoutMs: number): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await access(path);
      return;
    } catch {
      await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, 250));
    }
  }
  throw new Error(`Build nativo não produziu ${path} em ${timeoutMs} ms.`);
};

const identidadeNativa = async (): Promise<NativeAddonManifest> => {
  const requested = process.env.FOLIO_NATIVE_TARGET ?? nativeTargetId(process.platform, process.arch);
  const current = nativeTargetId(process.platform, process.arch);
  if (requested !== 'linux-x64') {
    throw new Error(`Target nativo não suportado no P18: ${requested}. O único target oficial é linux-x64.`);
  }
  if (requested !== current) {
    throw new Error(`P18 exige build nativo: target solicitado ${requested}, runner atual ${current}.`);
  }
  const electronExecutable = require('electron') as string;
  const electronIdentity = await executarEColetar(
    electronExecutable,
    ['-p', "process.versions.electron + ':' + process.versions.modules"],
    { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  );
  const [electronVersion, electronModuleAbi] = electronIdentity.split(':');
  if (electronVersion === undefined || electronModuleAbi === undefined || electronVersion === '' || electronModuleAbi === '') {
    throw new Error(`Não foi possível obter a identidade do runtime Electron: ${electronIdentity || 'vazia'}.`);
  }
  const betterSqlite3Version = require('better-sqlite3/package.json').version as string;
  const lockfileSha256 = createHash('sha256').update(await readFile(resolve(repositoryRoot, 'pnpm-lock.yaml'))).digest('hex');
  return createNativeAddonManifest({
    platform: 'linux',
    architecture: 'x64',
    electronVersion,
    electronModuleAbi,
    betterSqlite3Version,
    lockfileSha256,
  });
};

/** Recompila exclusivamente a cópia que o artefato desktop resolve primeiro. */
const compilarSqliteParaElectron = async (manifest: NativeAddonManifest): Promise<void> => {
  const nodeGyp = require.resolve('node-gyp/bin/node-gyp.js');
  const moduleDirectory = resolve(output, 'workspace/node_modules/better-sqlite3');
  const addon = resolve(moduleDirectory, 'build/Release/better_sqlite3.node');
  const cachedAddon = resolve(nativeCache, manifest.cacheKey, 'better_sqlite3.node');
  try {
    await access(cachedAddon);
    await mkdir(dirname(addon), { recursive: true });
    await copyFile(cachedAddon, addon);
    await esperarArquivo(addon, 1_000);
    return;
  } catch {
    // Cache é só aceleração. Um miss sempre recompila de modo reproduzível.
  }
  await executar(process.execPath, [
    nodeGyp,
    'rebuild',
    '--directory', moduleDirectory,
    `--target=${manifest.electronVersion}`,
    `--arch=${manifest.architecture}`,
    '--dist-url=https://electronjs.org/headers',
  ]);
  await esperarArquivo(addon, 120_000);
  await mkdir(dirname(cachedAddon), { recursive: true });
  await copyFile(addon, cachedAddon);
};

const bundleNode = async (entry: string, outfile: string): Promise<void> => {
  await esbuild({
    entryPoints: [resolve(root, entry)],
    outfile: resolve(root, outfile),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    // O desktop é construído a partir do workspace; sem esta condição o
    // esbuild prefere `dist` antigo de packages e pode omitir APIs recém
    // adicionadas mesmo com NODE_OPTIONS=--conditions=development.
    conditions: ['development'],
    sourcemap: true,
    // puppeteer-core sobe um Chromium externo e resolve o binário em runtime;
    // empacotar via esbuild não muda isso e só arrisca quebrar seus próprios
    // requires dinâmicos de plataforma. Fica de fora igual electron/sqlite e,
    // por isso, é dependência direta do app desktop (assim como pagedjs, que
    // renderer-pdf localiza dinamicamente pelo bundle distribuído).
    external: ['electron', 'better-sqlite3', 'puppeteer-core'],
  });
};

const skipNativeBuild = process.env.ABNT_SKIP_NATIVE_BUILD === '1';
const manifest = skipNativeBuild ? undefined : await identidadeNativa();
if (!skipNativeBuild) await prepararSqliteDoElectron();

await Promise.all([
  bundleNode('src/main/index.ts', 'dist/main/index.cjs'),
  bundleNode('src/preload/index.ts', 'dist/preload/index.cjs'),
  bundleNode('src/compiler-service/entry.ts', 'dist/compiler-service/index.cjs'),
  bundleNode('src/workspace/entry.ts', 'dist/workspace/index.cjs'),
  bundleNode('src/export-service/entry.ts', 'dist/export-service/index.cjs'),
  viteBuild({
    root: resolve(root, 'src/renderer'),
    base: './',
    plugins: [(await import('@vitejs/plugin-react')).default(), tailwindcss()],
    resolve: { conditions: ['development'] },
    build: { outDir: resolve(output, 'renderer'), emptyOutDir: true },
  }),
]);

await writeFile(resolve(output, BUILD_INFORMATION_FILE), `${JSON.stringify(buildInformation, null, 2)}\n`);

if (!skipNativeBuild && manifest !== undefined) {
  await compilarSqliteParaElectron(manifest);
  await writeFile(resolve(output, 'workspace', NATIVE_MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
}
