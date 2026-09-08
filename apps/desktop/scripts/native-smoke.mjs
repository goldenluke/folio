import { access, appendFile, cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const repositoryRoot = resolve(root, '../..');
const require = createRequire(import.meta.url);
const timeoutMs = 120_000;

const run = (command, args, environment) => new Promise((resolveRun, reject) => {
  const child = spawn(command, args, {
    cwd: repositoryRoot,
    env: environment,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  const capture = (chunk) => { output += String(chunk); };
  child.stdout.on('data', capture);
  child.stderr.on('data', capture);
  const timer = setTimeout(() => {
    child.kill('SIGTERM');
    reject(new Error(`Smoke Electron excedeu ${timeoutMs} ms.\n${output}`));
  }, timeoutMs);
  child.once('error', (error) => {
    clearTimeout(timer);
    reject(error);
  });
  child.once('exit', (code) => {
    clearTimeout(timer);
    if (code === 0) resolveRun(output);
    else reject(new Error(`Smoke Electron falhou (${code ?? 'desconhecido'}).\n${output}`));
  });
});

const temp = await mkdtemp(join(tmpdir(), 'folio-native-smoke-'));
const vault = join(temp, 'vault');
const exportedPdf = join(temp, 'artigo.pdf');

try {
  await cp(resolve(repositoryRoot, 'examples/artigo-demonstracao'), vault, { recursive: true });
  // Consulta FTS do smoke: o conteúdo é autoral e fica no vault temporário.
  await appendFile(join(vault, 'artigo.md'), '\n\nFolio native smoke.\n');

  const manifestPath = resolve(root, 'dist/workspace/native-addon.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.platform !== 'linux' || manifest.architecture !== 'x64' || manifest.product !== 'Folio') {
    throw new Error(`Manifesto nativo inesperado: ${JSON.stringify(manifest)}`);
  }

  const electron = require('electron');
  const output = await run(
    electron,
    ['--no-sandbox', resolve(root, 'dist/main/index.cjs')],
    {
      ...process.env,
      ABNT_DESKTOP_SMOKE_VAULT: vault,
      ABNT_DESKTOP_SMOKE_EXPORT_PATH: exportedPdf,
    },
  );
  await access(join(vault, '.academic', 'index.sqlite'));
  const pdf = await readFile(exportedPdf);
  if (!pdf.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error('Smoke Electron não produziu um PDF válido.');
  if (!output.includes('"workspace":true') || !output.includes('"editor":true') || !output.includes('"search":true') || !output.includes('"preview":true') || !output.includes('"export":true')) {
    throw new Error(`Smoke Electron não atravessou o fluxo real esperado.\n${output}`);
  }
  console.log('folio native smoke ok');
} finally {
  await rm(temp, { recursive: true, force: true });
}
