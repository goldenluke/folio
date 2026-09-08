import { access, mkdtemp, readdir, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(root, '../..');
const release = resolve(root, 'release');

export type LinuxArtifactTarget = 'dir' | 'deb';

const run = async (command: string, args: readonly string[], environment: NodeJS.ProcessEnv): Promise<void> => {
  await new Promise<void>((resolveRun, reject) => {
    const child = spawn(command, [...args], { cwd: repositoryRoot, stdio: 'inherit', env: environment });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolveRun();
      else reject(new Error(`${command} terminou com código ${code ?? 'desconhecido'} ao montar o artefato Linux do Folio.`));
    });
  });
};

/** Monta um artefato Linux a partir do stage P19, sempre com binding P18 novo. */
export async function assembleLinux(target: LinuxArtifactTarget): Promise<readonly string[]> {
  if (process.platform !== 'linux' || process.arch !== 'x64') {
    throw new Error(`P18/P20 só montam nativamente Linux x64; runner atual: ${process.platform}-${process.arch}.`);
  }

  const stage = await mkdtemp(join(tmpdir(), 'folio-package-stage-'));
  const environment = { ...process.env, FOLIO_NATIVE_TARGET: 'linux-x64', FOLIO_PACKAGE_STAGE: stage };
  try {
    await run('pnpm', ['--filter', '@abnt/desktop', 'build:native'], environment);
    await run('pnpm', ['--filter', '@abnt/desktop', 'exec', 'tsx', 'scripts/stage-package.ts'], environment);
    await rm(release, { recursive: true, force: true });
    await run('pnpm', ['--filter', '@abnt/desktop', 'exec', 'electron-builder', '--config', 'folio-builder.config.cjs', '--linux', target, '--x64'], environment);
    const artifacts = await readdir(release);
    if (target === 'dir') await access(resolve(release, 'linux-unpacked'));
    if (target === 'deb' && !artifacts.some((artifact) => artifact.endsWith('.deb'))) {
      throw new Error('electron-builder não produziu um instalador .deb.');
    }
    return artifacts.map((artifact) => resolve(release, artifact));
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}
