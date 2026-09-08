import { mkdtemp, readdir, readFile, rm, mkdir, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '..');
const BASELINES = join(ROOT, 'tests', 'visual-baselines');
const update = process.argv.includes('--update');

const fixtures = [
  { name: 'm4-abnt', profile: 'abnt-artigo', input: 'fixtures/m4/artigo.md', output: 'artigo' },
  { name: 'm4-web', profile: 'web-article', input: 'fixtures/m4/artigo.md', output: 'artigo' },
  { name: 'm5-tcc', profile: 'abnt-tcc', input: 'fixtures/m5/tcc.md', output: 'tcc' },
];

function run(command, args) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--conditions=development' } });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolveRun();
      else reject(new Error(`${command} terminou com código ${code ?? 'desconhecido'}.`));
    });
  });
}

async function pages(directory, prefix) {
  return (await readdir(directory))
    .filter((entry) => entry.startsWith(prefix) && entry.endsWith('.png'))
    .sort();
}

const temporary = await mkdtemp(join(tmpdir(), 'abnt-visual-'));
try {
  await mkdir(BASELINES, { recursive: true });
  for (const fixture of fixtures) {
    await run('pnpm', [
      'exec',
      'tsx',
      'apps/cli/src/bin.ts',
      'build',
      fixture.input,
      '--format',
      'pdf',
      '--perfil',
      fixture.profile,
      '--out',
      temporary,
    ]);
    const pdf = join(temporary, `${fixture.output}.pdf`);
    const prefix = join(temporary, fixture.name);
    await run('pdftoppm', ['-png', '-r', '100', pdf, prefix]);

    const current = await pages(temporary, `${fixture.name}-`);
    if (current.length === 0) throw new Error(`Nenhuma página renderizada para ${fixture.name}.`);

    if (update) {
      const old = await pages(BASELINES, `${fixture.name}-`);
      await Promise.all(old.map((page) => rm(join(BASELINES, page))));
      await Promise.all(current.map((page) => copyFile(join(temporary, page), join(BASELINES, page))));
      console.log(`baseline atualizado: ${fixture.name} (${current.length} página${current.length === 1 ? '' : 's'})`);
      continue;
    }

    const expected = await pages(BASELINES, `${fixture.name}-`);
    if (expected.length === 0) {
      throw new Error(`Baseline ausente para ${fixture.name}. Rode: pnpm test:visual -- --update`);
    }
    if (expected.length !== current.length) {
      throw new Error(`${fixture.name}: ${expected.length} páginas no baseline, ${current.length} no resultado.`);
    }
    for (const page of current) {
      const baseline = join(BASELINES, page);
      const generated = join(temporary, page);
      if (!(await readFile(baseline)).equals(await readFile(generated))) {
        throw new Error(`${fixture.name}: regressão visual detectada em ${page}.`);
      }
    }
    console.log(`visual ok: ${fixture.name} (${current.length} página${current.length === 1 ? '' : 's'})`);
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
