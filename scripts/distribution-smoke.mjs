import { access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

const run = (command, args, options = {}) =>
  new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], ...options });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolveRun() : reject(new Error(`${command} falhou (${code ?? 'desconhecido'}): ${stderr}`)));
  });

const required = [
  'apps/cli/dist/bin.js',
  'apps/cli/dist/index.js',
  'apps/lsp/dist/server.js',
  'packages/compiler/dist/index.js',
  'packages/protocol/dist/index.js',
  'apps/desktop/dist/main/index.cjs',
  'apps/desktop/dist/build-info.json',
  'apps/desktop/dist/preload/index.cjs',
  'apps/desktop/dist/renderer/index.html',
];

await Promise.all(required.map((path) => access(resolve(root, path))));
await run(process.execPath, ['apps/cli/dist/bin.js', '--help']);
// O servidor LSP considera EOF sem `initialize` uma falha de protocolo; para o
// artefato o smoke relevante é o parser Node, sem exigir um cliente LSP falso.
await run(process.execPath, ['--check', 'apps/lsp/dist/server.js']);
console.log('distribution smoke ok');
