import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import puppeteer from 'puppeteer-core';

/**
 * Backend de PDF: HTML + CSS Paged Media -> Paged.js -> Chromium -> PDF.
 *
 * Ver docs/adr/0003 para por que este caminho e não Typst. Em resumo: o mesmo
 * renderer HTML serve preview e PDF, e a fidelidade de layout fica sob nosso
 * controle em vez de depender de um template de terceiros.
 *
 * Extraído de apps/cli em P14 para o Export Service isolado do desktop
 * reaproveitar sem duplicar (ver ADR 0019) — o CLI grava direto em disco, o
 * desktop precisa dos bytes em memória para atravessar o MessagePort até o
 * processo que tem o diálogo de salvar nativo.
 */

const CANDIDATOS_CHROME = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

/**
 * Localiza um Chromium já instalado.
 *
 * Usamos `puppeteer-core` justamente para não baixar um segundo Chromium de
 * ~150 MB quando a máquina quase sempre já tem um. Para produto comercial isso
 * também tira do nosso colo o ciclo de atualização de segurança do browser.
 */
export function encontrarChrome(): string {
  const doAmbiente = process.env['ABNT_CHROME'] ?? process.env['PUPPETEER_EXECUTABLE_PATH'];
  if (doAmbiente !== undefined && doAmbiente !== '') {
    if (!existsSync(doAmbiente)) {
      throw new Error(`Chrome indicado por variável de ambiente não existe: ${doAmbiente}`);
    }
    return doAmbiente;
  }

  for (const caminho of CANDIDATOS_CHROME) {
    if (existsSync(caminho)) return caminho;
  }

  throw new Error(
    'Nenhum Chrome/Chromium encontrado. Instale um, ou aponte ABNT_CHROME para o executável.',
  );
}

/** Localiza o bundle do Paged.js dentro do pacote instalado. */
function caminhoDoPolyfill(): string {
  // O package roda como ESM normalmente, mas o desktop o inclui num bundle
  // CommonJS. `require` já existe nesse último caso; usar a função nativa
  // evita que esbuild esvazie `import.meta` e quebre a resolução de Paged.js.
  const nodeRequire = typeof require === 'function' ? require : createRequire(import.meta.url);
  // O mapa `exports` do pagedjs não expõe `./dist/*`, então resolvemos o
  // entrypoint e subimos até a raiz do pacote.
  let dir = dirname(nodeRequire.resolve('pagedjs'));

  for (;;) {
    const candidato = join(dir, 'dist', 'paged.polyfill.min.js');
    if (existsSync(candidato)) return candidato;
    const pai = dirname(dir);
    if (pai === dir) throw new Error('Não foi possível localizar dist/paged.polyfill.min.js.');
    dir = pai;
  }
}

export interface OpcoesDePdf {
  /** Grava também em disco, além de devolver os bytes. Omitido: só os bytes. */
  readonly destino?: string;
  /** Tempo máximo para a paginação. Documento longo pagina devagar. */
  readonly timeoutMs?: number;
}

export interface ResultadoDePdf {
  readonly paginas: number;
  readonly bytes: Uint8Array;
}

export async function gerarPdf(html: string, opcoes: OpcoesDePdf = {}): Promise<ResultadoDePdf> {
  const timeout = opcoes.timeoutMs ?? 60_000;
  const polyfill = await readFile(caminhoDoPolyfill(), 'utf8');

  const browser = await puppeteer.launch({
    executablePath: encontrarChrome(),
    headless: true,
    // Necessário em containers/CI, onde o sandbox do Chrome não sobe.
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  });

  try {
    const page = await browser.newPage();
    // O HTML é autocontido (CSS inline, sem recursos externos), então 'load'
    // já garante que não há nada pendente.
    await page.setContent(html, { waitUntil: 'load', timeout });

    // Desliga o auto-run do Paged.js para termos uma promessa de conclusão em
    // vez de ficar sondando o DOM torcendo para a paginação ter acabado.
    await page.evaluate(() => {
      (globalThis as unknown as { PagedConfig?: unknown }).PagedConfig = { auto: false };
    });

    await page.addScriptTag({ content: polyfill });

    // Este callback roda no Chromium, não no Node. `document` e afins são
    // alcançados via globalThis tipado à mão de propósito: adicionar "DOM" ao
    // lib do projeto deixaria o código Node referenciar globais de browser
    // sem erro de compilação.
    const paginas = await page.evaluate(async () => {
      const w = globalThis as unknown as {
        PagedPolyfill?: { preview: () => Promise<unknown> };
        document: { querySelectorAll: (s: string) => { length: number } };
      };
      if (w.PagedPolyfill === undefined) throw new Error('Paged.js não carregou.');
      await w.PagedPolyfill.preview();
      // Conta as páginas de fato geradas. O `total` devolvido por `preview()`
      // não incluía a última quando a paginação crescia durante o processo de
      // posicionar as notas de rodapé, e reportar contagem errada é pior que
      // não reportar nada.
      return w.document.querySelectorAll('.pagedjs_page').length;
    });

    // `page.pdf()` sempre devolve os bytes; `path` só adiciona a gravação em
    // disco como efeito colateral — é isso que permite um único caminho de
    // código servir tanto o CLI (grava direto) quanto o Export Service do
    // desktop (só precisa dos bytes para atravessar o MessagePort).
    const bytes = await page.pdf({
      ...(opcoes.destino !== undefined ? { path: opcoes.destino } : {}),
      printBackground: true,
      // O Paged.js já aplicou as margens no layout das páginas que gerou;
      // deixar o Chromium aplicar as dele de novo produziria margem dupla.
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      timeout,
    });

    return { paginas, bytes };
  } finally {
    await browser.close();
  }
}
