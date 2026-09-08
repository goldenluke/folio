import { access, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { runFolioRuntimeSmoke } from './smoke-runtime.mjs';

const root = resolve(import.meta.dirname, '..');
const repositoryRoot = resolve(root, '../..');
const release = resolve(root, 'release');
const artifacts = await readdir(release);
const installerName = artifacts.find((artifact) => artifact.endsWith('.deb'));
if (installerName === undefined) throw new Error('Instalador .deb ausente; execute pnpm --filter @abnt/desktop installer:linux.');
const installer = join(release, installerName);
const expectedVersion = (JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))).version;
// Debian ordena pré-releases com `~`; electron-builder converte o hífen SemVer
// para não fazer `0.1.0-dev.0` parecer posterior a `0.1.0` no apt.
const expectedDebianVersion = expectedVersion.replace('-', '~');

const run = (command, args, cwd) => new Promise((resolveRun, reject) => {
  const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', (chunk) => { output += String(chunk); });
  child.stderr.on('data', (chunk) => { output += String(chunk); });
  child.once('error', reject);
  child.once('exit', (code) => {
    if (code === 0) resolveRun(output);
    else reject(new Error(`${command} falhou (${code ?? 'desconhecido'}).\n${output}`));
  });
});

const temp = await mkdtemp(join(tmpdir(), 'folio-installer-smoke-'));
const installedRoot = join(temp, 'root');
try {
  const control = await run('dpkg-deb', ['--field', installer, 'Package', 'Version', 'Architecture'], temp);
  if (!control.includes('folio\n') || !control.includes(`${expectedDebianVersion}\n`) || !control.includes('amd64\n')) {
    throw new Error(`Metadados inesperados no instalador .deb:\n${control}`);
  }
  await run('dpkg-deb', ['--extract', installer, installedRoot], temp);
  const app = join(installedRoot, 'opt', 'Folio', 'folio');
  const desktop = join(installedRoot, 'usr', 'share', 'applications', 'folio.desktop');
  await access(app);
  const desktopEntry = await readFile(desktop, 'utf8');
  if (!desktopEntry.includes('Name=Folio') || !desktopEntry.includes('Exec=/opt/Folio/folio')) {
    throw new Error(`Desktop entry inválida:\n${desktopEntry}`);
  }
  // Sem PATH de Node/pnpm/tsx e fora do checkout: a árvore extraída é a única
  // fonte possível de runtime do aplicativo.
  await runFolioRuntimeSmoke({
    app,
    repositoryRoot,
    label: 'installer',
    environment: {
      HOME: temp,
      PATH: '/usr/bin:/bin',
      LANG: process.env.LANG ?? 'C.UTF-8',
      DISPLAY: process.env.DISPLAY ?? '',
    },
  });
  console.log('folio installer smoke ok');
} finally {
  await rm(temp, { recursive: true, force: true });
}
