import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repository = resolve(root, '../..');
const release = resolve(root, 'release');

const run = async (command: string, args: readonly string[], env: NodeJS.ProcessEnv): Promise<void> => new Promise((ok, fail) => {
  const pnpmCli = process.env.npm_execpath;
  if (command === 'pnpm' && !pnpmCli) return fail(new Error('Execute este script com pnpm run package:windows.'));
  const child = spawn(command === 'pnpm' ? process.execPath : command, command === 'pnpm' ? [pnpmCli!, ...args] : [...args], { cwd: repository, stdio: 'inherit', env });
  child.once('error', fail); child.once('exit', (code) => code === 0 ? ok() : fail(new Error(`${command} terminou com código ${code ?? 'desconhecido'}.`)));
});

if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error(`O pacote Windows exige runner win32-x64; atual: ${process.platform}-${process.arch}.`);
const stage = await mkdtemp(join(tmpdir(), 'folio-windows-stage-'));
try {
  const env = { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --conditions=development`.trim(), FOLIO_NATIVE_TARGET: 'win32-x64', FOLIO_PACKAGE_STAGE: stage };
  await run('pnpm', ['--filter', '@abnt/desktop', 'build:native:windows'], env);
  await run('pnpm', ['--filter', '@abnt/desktop', 'run', 'stage:package'], env);
  await run('pnpm', ['--filter', '@abnt/desktop', 'exec', 'electron-builder', '--config', 'folio-builder.config.cjs', '--win', 'nsis', '--x64'], env);
  const artifacts = await readdir(release);
  if (!artifacts.some((name) => name.endsWith('.exe'))) throw new Error('electron-builder não produziu o instalador Windows.');
  console.log(`folio Windows package ready: ${release}`);
} finally { await rm(stage, { recursive: true, force: true }); }
