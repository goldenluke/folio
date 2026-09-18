/** CF.12 — benchmark reproduzível das cargas que alimentam o PDF Workspace.
 * Mede indexação/listagem/busca do vault e compilação de documentos nas
 * escalas previstas. O reader visual depende do Electron e continua coberto
 * pelo smoke/regressão; este comando não finge medir pintura de Chromium.
 * Uso: pnpm benchmark:pdf-workspace
 */
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const tiers = [50, 200, 500, 1000];

function run(script, pages) {
  return new Promise((resolveRun, reject) => {
    const child = spawn('pnpm', ['exec', 'tsx', `scripts/${script}`, `--pages=${pages}`, '--skip-pdf'], {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, NODE_OPTIONS: '--conditions=development' },
    });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolveRun() : reject(new Error(`${script} falhou (${code ?? 'sem código'}).`)));
  });
}

for (const pages of tiers) await run('benchmark-large-document.ts', pages);
