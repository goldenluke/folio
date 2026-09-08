import { access, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(root, '../..');
const dist = resolve(root, 'dist');
const stage = resolve(process.env.FOLIO_PACKAGE_STAGE ?? resolve(root, '.package'));

const run = async (command: string, args: readonly string[]): Promise<void> => {
  await new Promise<void>((resolveRun, reject) => {
    const child = spawn(command, [...args], { cwd: repositoryRoot, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolveRun();
      else reject(new Error(`${command} terminou com código ${code ?? 'desconhecido'} ao preparar o package.`));
    });
  });
};

await access(resolve(dist, 'main', 'index.cjs'));
await access(resolve(dist, 'workspace', 'native-addon.json'));
await access(resolve(dist, 'build-info.json'));

// `deploy --prod` cria um app-root sem pnpm, tsx, TypeScript ou devDependencies.
// O runtime compilado vem depois: ele já contém a cópia Electron do SQLite.
await rm(stage, { recursive: true, force: true });
// O package Linux usa um stage fora do monorepo (FOLIO_PACKAGE_STAGE), para
// que o electron-builder não caminhe até o node_modules de desenvolvimento.
await run('pnpm', ['--filter', '@abnt/desktop', 'deploy', '--prod', '--ignore-scripts', stage]);
await cp(dist, resolve(stage, 'dist'), { recursive: true, force: true });
const deployedPackage = JSON.parse(await readFile(resolve(stage, 'package.json'), 'utf8')) as {
  readonly version: string;
  readonly dependencies: Readonly<Record<string, string>>;
};
// Todos os packages `@abnt/*` já foram embutidos nos bundles CJS. Manter suas
// cópias (ou o better-sqlite3 compilado para Node) no app root só aumentaria o
// artefato e criaria uma segunda rota possível para o addon.
await rm(resolve(stage, 'node_modules', '@abnt'), { recursive: true, force: true });
await rm(resolve(stage, 'node_modules', 'better-sqlite3'), { recursive: true, force: true });
await writeFile(
  resolve(stage, 'package.json'),
  `${JSON.stringify({
    name: 'folio',
    version: deployedPackage.version,
    private: true,
    type: 'module',
    main: './dist/main/index.cjs',
    description: 'IDE acadêmico local-first para leitura, escrita e publicação.',
    author: 'Folio',
    homepage: 'https://goldenluke.github.io/folio',
    desktopName: 'folio',
    dependencies: {
      pagedjs: deployedPackage.dependencies.pagedjs,
      'puppeteer-core': deployedPackage.dependencies['puppeteer-core'],
    },
  }, null, 2)}\n`,
);
await mkdir(resolve(stage, 'build'), { recursive: true });
await writeFile(
  resolve(stage, 'build', 'folio-package.json'),
  `${JSON.stringify({
    product: 'Folio',
    target: 'linux-x64',
    unsigned: true,
    nativeManifest: 'dist/workspace/native-addon.json',
  }, null, 2)}\n`,
);

await access(resolve(stage, 'dist', 'workspace', 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node'));
await access(resolve(stage, 'node_modules', 'puppeteer-core'));
await access(resolve(stage, 'node_modules', 'pagedjs'));
console.log(`folio package stage ready: ${stage}`);
