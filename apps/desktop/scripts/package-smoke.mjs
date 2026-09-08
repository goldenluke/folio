import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

import { runFolioRuntimeSmoke } from './smoke-runtime.mjs';

const root = resolve(import.meta.dirname, '..');
const repositoryRoot = resolve(root, '../..');
const app = resolve(root, 'release', 'linux-unpacked', 'folio');

await access(app);
await access(resolve(root, 'release', 'linux-unpacked', 'resources', 'app.asar'));
await access(resolve(root, 'release', 'linux-unpacked', 'resources', 'workspace-runtime', 'native-addon.json'));
await access(resolve(root, 'release', 'linux-unpacked', 'resources', 'workspace-runtime', 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node'));

await runFolioRuntimeSmoke({ app, repositoryRoot, label: 'package' });
console.log('folio package smoke ok');
