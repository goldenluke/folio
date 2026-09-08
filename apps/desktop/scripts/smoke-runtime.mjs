import { access, appendFile, cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const timeoutMs = 120_000;

const run = (command, args, environment, cwd, label) => new Promise((resolveRun, reject) => {
  const child = spawn(command, args, {
    cwd,
    env: environment,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  const capture = (chunk) => { output += String(chunk); };
  child.stdout.on('data', capture);
  child.stderr.on('data', capture);
  const timer = setTimeout(() => {
    child.kill('SIGTERM');
    reject(new Error(`Smoke ${label} excedeu ${timeoutMs} ms.\n${output}`));
  }, timeoutMs);
  child.once('error', (error) => {
    clearTimeout(timer);
    reject(error);
  });
  child.once('exit', (code) => {
    clearTimeout(timer);
    if (code === 0) resolveRun(output);
    else reject(new Error(`Smoke ${label} falhou (${code ?? 'desconhecido'}).\n${output}`));
  });
});

/** Exercita a aplicação exatamente como um usuário: sem bridge de desenvolvimento. */
export async function runFolioRuntimeSmoke({ app, repositoryRoot, environment = process.env, label }) {
  const temp = await mkdtemp(join(tmpdir(), `folio-${label}-`));
  const vault = join(temp, 'vault');
  const pdfPath = join(temp, 'artigo.pdf');
  const docxPath = join(temp, 'artigo.docx');
  try {
    await cp(resolve(repositoryRoot, 'examples/artigo-demonstracao'), vault, { recursive: true });
    await appendFile(join(vault, 'artigo.md'), `\n\nFolio ${label} smoke.\n`);
    const output = await run(app, ['--no-sandbox'], {
      ...environment,
      ABNT_DESKTOP_SMOKE_VAULT: vault,
      ABNT_DESKTOP_SMOKE_EXPORT_PATH: pdfPath,
      ABNT_DESKTOP_SMOKE_DOCX_PATH: docxPath,
      ABNT_DESKTOP_SMOKE_PACKAGE: '1',
    }, temp, label);
    for (const property of ['workspace', 'editor', 'edit', 'save', 'reopen', 'search', 'preview', 'export', 'docx']) {
      if (!output.includes(`"${property}":true`)) throw new Error(`Smoke ${label} não confirmou ${property}.\n${output}`);
    }
    await access(join(vault, '.academic', 'index.sqlite'));
    const [pdf, docx, article] = await Promise.all([readFile(pdfPath), readFile(docxPath), readFile(join(vault, 'artigo.md'), 'utf8')]);
    if (!pdf.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error(`Smoke ${label} não produziu PDF válido.`);
    if (!docx.subarray(0, 2).equals(Buffer.from('PK'))) throw new Error(`Smoke ${label} não produziu DOCX válido.`);
    if (!article.includes('Folio packaged smoke persisted.')) throw new Error(`Edição do smoke ${label} não foi persistida no vault.`);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
