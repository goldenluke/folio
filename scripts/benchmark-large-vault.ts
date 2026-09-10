/**
 * F147 — Large Vault Benchmark. Gera um vault sintético (documentos,
 * referências, links, tags, projetos, annotations/attachments como metadata
 * — sem bytes reais de PDF, para manter o benchmark rápido) e mede abertura,
 * listagem e busca contra ele. Local: escreve num diretório temporário e
 * apaga ao final (a menos que `--keep` seja passado).
 *
 * Uso:
 *   NODE_OPTIONS=--conditions=development tsx scripts/benchmark-large-vault.ts --docs=100 --refs=1000
 *
 * Tiers do roadmap (F147): docs 100/1.000/10.000, refs 1.000/10.000/50.000.
 * Tiers grandes demoram (E/S real por arquivo) — rode-os intencionalmente,
 * não como parte do `pnpm test`.
 */
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { exportarCslJson } from '@abnt/bibliography';
import type { BibliographicEntity, Registry } from '@abnt/document-model';
import { LocalFilesystemStorage } from '@abnt/workspace-local';
import { SqliteWorkspaceIndex } from '@abnt/workspace-index';

interface Args {
  readonly docs: number;
  readonly refs: number;
  readonly keep: boolean;
}

function parseArgs(argv: readonly string[]): Args {
  const flag = (name: string, fallback: number): number => {
    const match = argv.find((arg) => arg.startsWith(`--${name}=`));
    return match === undefined ? fallback : Number(match.slice(name.length + 3));
  };
  return { docs: flag('docs', 100), refs: flag('refs', 1000), keep: argv.includes('--keep') };
}

function buildReferences(count: number): Registry<BibliographicEntity> {
  const entries: Record<string, BibliographicEntity> = {};
  for (let index = 0; index < count; index += 1) {
    const id = `ref${index}`;
    entries[id] = {
      id,
      type: 'article-journal',
      title: `Estudo sintético número ${index}`,
      author: [{ family: `Autor${index % 500}`, given: 'A.' }],
      issued: { 'date-parts': [[2000 + (index % 25)]] },
      'container-title': `Revista Sintética ${index % 40}`,
    };
  }
  return entries;
}

function buildDocument(index: number, docCount: number, refIds: readonly string[]): string {
  const cites = [refIds[index % refIds.length], refIds[(index * 7 + 3) % refIds.length]].filter((id, position, all) => id !== undefined && all.indexOf(id) === position);
  const linksTo = docCount > 1 ? `doc${(index + 1) % docCount}` : undefined;
  const tag = ['metodologia', 'resultados', 'discussao', 'revisao'][index % 4];
  return [
    '---',
    `title: "Documento sintético ${index}"`,
    `tags: [${tag}]`,
    '---',
    '',
    `# Documento sintético ${index}`,
    '',
    `Parágrafo introdutório do documento ${index}, com uma citação `,
    cites.map((id) => `[@${id}]`).join(' e '),
    'e mais algum texto de preenchimento para simular prosa real de um artigo acadêmico completo o suficiente para indexação de texto completo.',
    '',
    '## Seção',
    '',
    linksTo === undefined ? 'Sem link para outro documento.' : `Ver também [[${linksTo}.md]].`,
    '',
  ].join('\n');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const root = await mkdtemp(join(tmpdir(), 'abnt-bench-vault-'));
  console.log(`Vault sintético em ${root} (docs=${args.docs}, refs=${args.refs})`);

  const genStart = performance.now();
  const refIds = Array.from({ length: args.refs }, (_unused, index) => `ref${index}`);
  await Promise.all(Array.from({ length: args.docs }, (_unused, index) =>
    writeFile(join(root, `doc${index}.md`), buildDocument(index, args.docs, refIds), 'utf8')));
  await mkdir(join(root, 'references'), { recursive: true });
  await writeFile(join(root, 'references', 'library.json'), exportarCslJson(buildReferences(args.refs)), 'utf8');
  console.log(`Geração de fixtures: ${(performance.now() - genStart).toFixed(0)} ms`);

  const storage = LocalFilesystemStorage.create(root);
  const openStart = performance.now();
  const opened = await storage.open();
  const openMs = performance.now() - openStart;
  console.log(`storage.open() (inclui varredura inicial): ${openMs.toFixed(0)} ms — ${opened.files.length} arquivos`);

  const databasePath = join(root, '.academic', 'index.sqlite');
  const index = SqliteWorkspaceIndex.create({ storage, databasePath });
  const indexOpenStart = performance.now();
  await index.open();
  const indexOpenMs = performance.now() - indexOpenStart;
  console.log(`index.open() (rebuild/indexação completa): ${indexOpenMs.toFixed(0)} ms`);

  const listStart = performance.now();
  await storage.list();
  console.log(`storage.list(): ${(performance.now() - listStart).toFixed(0)} ms`);

  const searchStart = performance.now();
  const results = index.search('sintético');
  console.log(`index.search('sintético'): ${(performance.now() - searchStart).toFixed(0)} ms — ${results.length} resultados`);

  await index.close();
  await storage.close();

  if (args.keep) {
    console.log(`Vault mantido em ${root} (--keep).`);
  } else {
    await rm(root, { recursive: true, force: true });
    console.log('Vault temporário removido.');
  }
}

void main();
