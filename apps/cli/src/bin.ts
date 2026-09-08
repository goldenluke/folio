#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

import { Command } from 'commander';

import { gerarPdf } from '@abnt/renderer-pdf';
import { renderizarDocx } from '@abnt/renderer-docx';

import { compilar, PERFIL_PADRAO, PERFIS } from './pipeline.js';
import { executarPluginsDeLint } from './plugins.js';
import { cinza, formatarDiagnosticos, negrito, resumo, verde, vermelho } from './report.js';

const programa = new Command();

programa
  .name('abnt')
  .description('Compilador de documentos acadêmicos com Markdown como linguagem de autoria.')
  .version('0.1.0-dev.0');

const ms = (inicio: number): string => `${(performance.now() - inicio).toFixed(0)}ms`;

programa
  .command('build')
  .description('Compila um documento para PDF ou HTML.')
  .argument('<arquivo>', 'arquivo Markdown de entrada')
  .option('-f, --format <formato>', 'pdf | html | docx', 'pdf')
  .option('-o, --out <dir>', 'diretório de saída', 'dist')
  .option('-p, --perfil <nome>', `perfil de publicação (${Object.keys(PERFIS).join(', ')}; padrão: ${PERFIL_PADRAO})`)
  .action(async (arquivo: string, opcoes: { format: string; out: string; perfil?: string }) => {
    const caminho = resolve(arquivo);
    const nome = basename(caminho, extname(caminho));

    const formato = opcoes.format.toLowerCase();
    if (formato !== 'pdf' && formato !== 'html' && formato !== 'docx') {
      console.error(vermelho(`Formato inválido: "${opcoes.format}". Use pdf, html ou docx.`));
      process.exitCode = 2;
      return;
    }

    let fonte: string;
    try {
      fonte = await readFile(caminho, 'utf8');
    } catch {
      console.error(vermelho(`Não foi possível ler: ${caminho}`));
      process.exitCode = 2;
      return;
    }

    const t0 = performance.now();
    const etapas = await compilar(fonte, {
      documentId: basename(caminho),
      ...(opcoes.perfil !== undefined ? { perfil: opcoes.perfil } : {}),
      baseDir: dirname(caminho),
      sourcePath: basename(caminho),
      // PDF e DOCX são gerados a partir da Publication AST sem documento de
      // origem: um caminho relativo não teria contra o que resolver, então o
      // recurso vai embutido. HTML fica servido ao lado do arquivo, então
      // pode continuar referenciando o caminho relativo original.
      embutirRecursos: formato === 'pdf' || formato === 'docx',
    });
    console.log(`  ${verde('✓')} compilar        ${cinza(ms(t0))}`);

    if (etapas.diagnosticos.length > 0) {
      console.log('');
      console.log(formatarDiagnosticos(etapas.diagnosticos, arquivo));
    }

    const destinoDir = resolve(dirname(caminho), opcoes.out);
    await mkdir(destinoDir, { recursive: true });

    if (formato === 'html') {
      const destino = join(destinoDir, `${nome}.html`);
      await writeFile(destino, etapas.html, 'utf8');
      console.log(`  ${verde('✓')} ${negrito(destino)}`);
      return;
    }

    if (formato === 'docx') {
      const t1 = performance.now();
      const destino = join(destinoDir, `${nome}.docx`);
      const bytes = await renderizarDocx(etapas.publicacao);
      await writeFile(destino, bytes);
      console.log(`  ${verde('✓')} converter       ${cinza(ms(t1))}`);
      console.log(`  ${verde('✓')} ${negrito(destino)}`);
      return;
    }

    const t1 = performance.now();
    const destino = join(destinoDir, `${nome}.pdf`);
    try {
      const { paginas } = await gerarPdf(etapas.html, { destino });
      console.log(`  ${verde('✓')} paginar         ${cinza(`${ms(t1)} · ${paginas} pág.`)}`);
      console.log(`  ${verde('✓')} ${negrito(destino)}`);
    } catch (erro) {
      console.error(vermelho(`\nFalha ao gerar PDF: ${(erro as Error).message}`));
      process.exitCode = 1;
    }
  });

programa
  .command('lint')
  .description('Valida o documento e reporta violações de norma.')
  .argument('<arquivo>', 'arquivo Markdown de entrada')
  .option('-p, --perfil <nome>', `perfil de publicação (padrão: ${PERFIL_PADRAO})`)
  .option(
    '-P, --plugin <caminho>',
    'plugin de lint adicional, isolado num processo próprio (repetível)',
    (valor: string, anteriores: string[]) => [...anteriores, valor],
    [] as string[],
  )
  .action(async (arquivo: string, opcoes: { perfil?: string; plugin: string[] }) => {
    const caminho = resolve(arquivo);

    let fonte: string;
    try {
      fonte = await readFile(caminho, 'utf8');
    } catch {
      console.error(vermelho(`Não foi possível ler: ${caminho}`));
      process.exitCode = 2;
      return;
    }

    const etapas = await compilar(fonte, {
      documentId: basename(caminho),
      ...(opcoes.perfil !== undefined ? { perfil: opcoes.perfil } : {}),
      baseDir: dirname(caminho),
      sourcePath: basename(caminho),
    });

    const diagnosticosDePlugins = await executarPluginsDeLint(opcoes.plugin, etapas.resolvido);
    const diagnosticos = [...etapas.diagnosticos, ...diagnosticosDePlugins];

    if (diagnosticos.length > 0) {
      console.log(formatarDiagnosticos(diagnosticos, arquivo));
    }
    console.log(resumo(diagnosticos));

    if (diagnosticos.some((d) => d.severity === 'error')) process.exitCode = 1;
  });

await programa.parseAsync(process.argv);
