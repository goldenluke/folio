import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

import { runFolioRuntimeSmoke } from './smoke-runtime.mjs';

if (process.platform !== 'win32' || process.arch !== 'x64') {
  throw new Error(`O smoke Windows exige runner win32-x64; atual: ${process.platform}-${process.arch}.`);
}

const root = resolve(import.meta.dirname, '..');
const repositoryRoot = resolve(root, '../..');
const appRoot = resolve(root, 'release', 'win-unpacked');
const app = resolve(appRoot, 'Folio.exe');

await access(app);
await access(resolve(appRoot, 'resources', 'app.asar'));
await access(resolve(appRoot, 'resources', 'workspace-runtime', 'native-addon.json'));
await access(resolve(appRoot, 'resources', 'workspace-runtime', 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node'));

await runFolioRuntimeSmoke({ app, repositoryRoot, label: 'windows-package' });
console.log('folio Windows package smoke ok');
