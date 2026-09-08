import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

await import('./build.js');

const electron = process.platform === 'win32'
  ? resolve(root, 'node_modules', '.bin', 'electron.cmd')
  : resolve(root, 'node_modules', '.bin', 'electron');
const child = spawn(electron, [resolve(root, 'dist/main/index.cjs')], { stdio: 'inherit' });
child.once('exit', (code) => {
  process.exitCode = code ?? 1;
});
