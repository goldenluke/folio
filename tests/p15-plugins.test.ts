import { fork } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { compilar } from '@abnt/cli';
import { resolvedDocumentParaDto } from '@abnt/compiler';
import { PluginHost } from '@abnt/plugin-host';

const EXEMPLO_PARAGRAFO_LONGO = resolve('examples/plugins/paragrafo-longo.mjs');

const PARAGRAFO_CURTO = 'Este parágrafo é curto o bastante para não disparar nenhum aviso.';
const PARAGRAFO_LONGO = Array.from({ length: 160 }, (_, i) => `palavra${i}`).join(' ') + '.';

const FONTE = `# Introdução\n\n${PARAGRAFO_CURTO}\n\n## Seção\n\n${PARAGRAFO_LONGO}\n`;

/** Script de plugin sem nenhuma dependência de workspace — só o protocolo cru, para testar falhas específicas sem depender de resolução de módulo fora do repo. */
const withTempPlugin = async (script: string, run: (entryPath: string) => Promise<void>): Promise<void> => {
  const dir = await mkdtemp(join(tmpdir(), 'abnt-p15-plugin-'));
  const entryPath = join(dir, 'plugin.mjs');
  try {
    await writeFile(entryPath, script, 'utf8');
    await run(entryPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

describe('P15 — plugin de lint isolado (PluginHost + @abnt/plugin-api)', () => {
  it('roda o plugin de exemplo isolado num processo próprio e recebe seu diagnóstico', async () => {
    const etapas = await compilar(FONTE, { documentId: 'p15.md' });
    const documento = resolvedDocumentParaDto(etapas.resolvido);

    const host = new PluginHost(EXEMPLO_PARAGRAFO_LONGO);
    try {
      const info = await host.ready();
      expect(info).toMatchObject({ id: 'exemplo.paragrafo-longo', version: '0.1.0' });

      const diagnosticos = await host.lint(documento);
      expect(diagnosticos).toHaveLength(1);
      expect(diagnosticos[0]).toMatchObject({ id: 'EXEMPLO-PARAGRAFO-LONGO', severity: 'warning' });
      expect(diagnosticos[0]?.message).toContain('160 palavras');
      // O parágrafo curto não deveria aparecer — só o de 160 palavras dispara o aviso.
      expect(diagnosticos[0]?.source?.start.line).toBeGreaterThan(2);
    } finally {
      host.dispose();
    }
  });

  it('um plugin que lança durante lint() não derruba quem chamou — vira erro rejeitado', async () => {
    await withTempPlugin(
      `
      process.send({ version: 1, type: 'abnt-plugin/ready', plugin: { id: 'teste.quebrado', version: '0.0.1' } });
      process.on('message', (msg) => {
        process.send({ version: 1, type: 'abnt-plugin/lint-result', requestId: msg.requestId, ok: false, error: 'propositalmente quebrado' });
      });
      `,
      async (entryPath) => {
        const etapas = await compilar(FONTE, { documentId: 'p15.md' });
        const documento = resolvedDocumentParaDto(etapas.resolvido);
        const host = new PluginHost(entryPath);
        try {
          await expect(host.lint(documento)).rejects.toThrow('propositalmente quebrado');
        } finally {
          host.dispose();
        }
      },
    );
  });

  it('um plugin que cai antes de responder rejeita a chamada em vez de travar para sempre', async () => {
    await withTempPlugin(
      `
      process.send({ version: 1, type: 'abnt-plugin/ready', plugin: { id: 'teste.cai', version: '0.0.1' } });
      process.on('message', () => { process.exit(1); });
      `,
      async (entryPath) => {
        const etapas = await compilar(FONTE, { documentId: 'p15.md' });
        const documento = resolvedDocumentParaDto(etapas.resolvido);
        const host = new PluginHost(entryPath);
        try {
          await expect(host.lint(documento)).rejects.toThrow(/encerrou/);
        } finally {
          host.dispose();
        }
      },
    );
  });

  it('um plugin que nunca anuncia "ready" rejeita depois do tempo limite de startup, não trava para sempre', async () => {
    await withTempPlugin('setInterval(() => {}, 1000);', async (entryPath) => {
      const host = new PluginHost(entryPath, { startupTimeoutMs: 200 });
      try {
        await expect(host.ready()).rejects.toThrow(/não respondeu "ready"/);
      } finally {
        host.dispose();
      }
    });
  });

  it('sanity check: o processo do plugin de exemplo realmente sobe isolado (fork de verdade)', async () => {
    // Não usa PluginHost aqui de propósito — prova que o plugin roda fora do
    // processo de teste falando o protocolo cru, sem atalho nenhum do host.
    await new Promise<void>((resolvePromise, reject) => {
      const child = fork(EXEMPLO_PARAGRAFO_LONGO, [], { stdio: 'pipe', execArgv: ['--conditions=development', '--import', 'tsx'] });
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('timeout esperando ready'));
      }, 5000);
      child.on('message', (message) => {
        clearTimeout(timeout);
        expect(message).toMatchObject({ type: 'abnt-plugin/ready' });
        expect(child.pid).not.toBe(process.pid);
        child.kill();
        resolvePromise();
      });
      child.on('error', reject);
    });
  });

  it('suporta comandos declarativos e exportação textual sem dar ao plugin acesso ao renderer', async () => {
    await withTempPlugin(
      `
      process.send({ version: 1, type: 'abnt-plugin/ready', plugin: { id: 'teste.produto', version: '0.0.1' } });
      process.on('message', (msg) => {
        if (msg.type === 'abnt-plugin/command') process.send({ version: 1, type: 'abnt-plugin/command-result', requestId: msg.requestId, ok: true, result: { kind: 'notice', message: 'Comando executado.' } });
        if (msg.type === 'abnt-plugin/export') process.send({ version: 1, type: 'abnt-plugin/export-result', requestId: msg.requestId, ok: true, result: { content: 'exportação do plugin' } });
      });
      `,
      async (entryPath) => {
        const etapas = await compilar(FONTE, { documentId: 'p15.md' });
        const host = new PluginHost(entryPath);
        try {
          await expect(host.command('teste.aviso', {})).resolves.toMatchObject({ kind: 'notice', message: 'Comando executado.' });
          await expect(host.export('teste.txt', etapas.publication)).resolves.toEqual({ content: 'exportação do plugin' });
        } finally {
          host.dispose();
        }
      },
    );
  });
});
