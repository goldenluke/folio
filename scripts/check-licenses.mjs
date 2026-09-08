#!/usr/bin/env node
/**
 * Gate de licença.
 *
 * Existe por um motivo concreto e não hipotético: o caminho óbvio para
 * processar citações neste projeto é `citeproc-js`, que é CPAL-1.0/AGPL-1.0.
 * Ambas têm cláusula de deployment em rede e são incompatíveis com produto
 * comercial fechado. Alguém — humano ou LLM — vai tentar instalar esse pacote
 * por reflexo. Este script faz o build quebrar quando isso acontecer.
 *
 * Ver docs/adr/0002.
 *
 * Distingue runtime de dev: uma ferramenta de build copyleft não é
 * distribuída e não contamina nada, então só vira aviso. Um gate que
 * reclama do que não importa é um gate que alguém vai desligar.
 *
 * Anda pelo grafo real de node_modules (seguindo os symlinks do pnpm) em vez
 * de listar o store `.pnpm`, que retém pacotes já removidos e produziria
 * falso positivo depois de todo `pnpm remove`.
 */

import { readdir, readFile, realpath } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

/** Copyleft forte ou cláusula de rede — proibido em runtime. */
const PROIBIDAS = [
  /\bAGPL\b/i,
  /\bCPAL\b/i,
  /\bSSPL\b/i,
  /\bOSL\b/i,
  /\bRPL\b/i,
  /\bEUPL\b/i,
  /\bGPL-[23]\.0(?!-or-later-WITH-|.*exception)/i,
  /^GPL(-[23])?$/i,
];

/** Copyleft fraco — permitido, mas registrado. */
const ATENCAO = [/\bLGPL\b/i, /\bMPL\b/i, /\bCC-BY-SA\b/i, /\bCDDL\b/i];

/**
 * Exceções revisadas manualmente. 'nome@versao' => justificativa.
 * Só adicione depois de ler a licença de verdade.
 */
const EXCECOES = new Map([
  // jszip é dual-licenciada de propósito pelo autor: "(MIT OR GPL-3.0-or-later)"
  // é uma escolha oferecida ao consumidor, não um projeto que virou copyleft.
  // @abnt/renderer-docx (P14) escolhe o ramo MIT via `docx`, que só usa jszip
  // para montar o contêiner ZIP de um .docx (OOXML). Decisão revisada e
  // registrada no ADR 0019.
  ['jszip@3.10.1', 'Dual MIT/GPL-3.0-or-later deliberado do autor; escolhemos MIT. Ver ADR 0019.'],
]);

function normalizarLicenca(pkgJson) {
  const { license, licenses } = pkgJson;
  if (typeof license === 'string') return license;
  if (license && typeof license === 'object' && license.type) return license.type;
  if (Array.isArray(licenses)) {
    const tipos = licenses.map((l) => (typeof l === 'string' ? l : l?.type)).filter(Boolean);
    if (tipos.length > 0) return tipos.join(' OR ');
  }
  return null;
}

async function lerJson(caminho) {
  try {
    return JSON.parse(await readFile(caminho, 'utf8'));
  } catch {
    return null;
  }
}

/** Lista os packages do workspace declarados em pnpm-workspace.yaml. */
async function raizesDoWorkspace() {
  const raizes = [ROOT];
  for (const grupo of ['packages', 'apps']) {
    let entradas;
    try {
      entradas = await readdir(join(ROOT, grupo), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entradas) {
      if (e.isDirectory()) raizes.push(join(ROOT, grupo, e.name));
    }
  }
  return raizes;
}

/**
 * BFS pelo grafo real de dependências.
 *
 * pnpm liga `node_modules/<dep>` -> `.pnpm/<pkg>@<ver>/node_modules/<pkg>`, e
 * cada pacote tem seu próprio `node_modules/` com as deps dele. Seguir esses
 * symlinks reproduz exatamente o que está instalado e alcançável.
 *
 * `runtime` propaga: dependência de um pacote de runtime também é runtime.
 * Um pacote alcançável pelos dois caminhos conta como runtime.
 */
async function coletarPacotes() {
  const encontrados = new Map(); // id -> { nome, versao, licenca, runtime }
  const visitados = new Map(); // realpath -> runtime
  const fila = [];

  for (const raiz of await raizesDoWorkspace()) {
    const pkg = await lerJson(join(raiz, 'package.json'));
    if (!pkg) continue;
    const nm = [join(raiz, 'node_modules')];
    for (const nome of Object.keys(pkg.dependencies ?? {})) {
      fila.push({ nome, dirs: nm, runtime: true });
    }
    for (const nome of Object.keys(pkg.devDependencies ?? {})) {
      fila.push({ nome, dirs: nm, runtime: false });
    }
  }

  while (fila.length > 0) {
    const { nome, dirs, runtime } = fila.shift();

    // Resolve na primeira pasta candidata que existir.
    let real = null;
    for (const dir of dirs) {
      try {
        real = await realpath(join(dir, nome));
        break;
      } catch {
        /* tenta a próxima */
      }
    }
    if (real === null) continue; // opcional não instalada nesta plataforma

    // Já visitado com escopo igual ou mais forte (runtime > dev): pula.
    const anterior = visitados.get(real);
    if (anterior === true || (anterior === false && !runtime)) continue;
    visitados.set(real, runtime);

    const pkg = await lerJson(join(real, 'package.json'));
    if (!pkg?.name || !pkg.version) continue;

    // Packages first-party do próprio workspace não têm licença a auditar.
    const ehPrimeiraParte = real.startsWith(`${ROOT}/`) && !real.includes('/node_modules/');
    if (!ehPrimeiraParte) {
      const id = `${pkg.name}@${pkg.version}`;
      const existente = encontrados.get(id);
      encontrados.set(id, {
        nome: pkg.name,
        versao: pkg.version,
        licenca: normalizarLicenca(pkg),
        runtime: runtime || existente?.runtime === true,
      });
    }

    // No layout do pnpm um pacote fica em `.pnpm/<pkg>@<ver>/node_modules/<pkg>`
    // e as deps dele são IRMÃS, em `.pnpm/<pkg>@<ver>/node_modules/<dep>` — não
    // aninhadas. Workspace packages usam o layout aninhado normal. Tentamos os
    // dois, nessa ordem.
    const candidatos = [join(real, 'node_modules')];
    const pai = dirname(pkg.name.startsWith('@') ? dirname(real) : real);
    if (basename(pai) === 'node_modules') candidatos.push(pai);

    // Só `dependencies` propaga — devDependencies de uma dep não são instaladas.
    for (const sub of Object.keys(pkg.dependencies ?? {})) {
      fila.push({ nome: sub, dirs: candidatos, runtime });
    }
    for (const sub of Object.keys(pkg.optionalDependencies ?? {})) {
      fila.push({ nome: sub, dirs: candidatos, runtime });
    }
  }

  return encontrados;
}

const pacotes = await coletarPacotes();

const violacoes = [];
const violacoesDev = [];
const avisos = [];
const desconhecidas = [];

for (const [id, info] of pacotes) {
  if (EXCECOES.has(id)) continue;

  if (!info.licenca) {
    if (info.runtime) desconhecidas.push(id);
    continue;
  }
  if (PROIBIDAS.some((re) => re.test(info.licenca))) {
    (info.runtime ? violacoes : violacoesDev).push({ id, licenca: info.licenca });
    continue;
  }
  if (ATENCAO.some((re) => re.test(info.licenca)) && info.runtime) {
    avisos.push({ id, licenca: info.licenca });
  }
}

const porId = (a, b) => a.id.localeCompare(b.id);
const nRuntime = [...pacotes.values()].filter((p) => p.runtime).length;

console.log(`Licenças verificadas: ${pacotes.size} pacotes (${nRuntime} em runtime).`);

if (avisos.length > 0) {
  console.log('\nCopyleft fraco em runtime (permitido, mas saiba que está usando):');
  for (const { id, licenca } of avisos.sort(porId)) console.log(`  ${id} — ${licenca}`);
}

if (violacoesDev.length > 0) {
  console.log('\nCopyleft forte, mas só em devDependencies (não distribuído — OK):');
  for (const { id, licenca } of violacoesDev.sort(porId)) console.log(`  ${id} — ${licenca}`);
}

if (desconhecidas.length > 0) {
  console.log(`\nSem campo de licença em runtime (${desconhecidas.length}) — verifique à mão:`);
  for (const id of desconhecidas.sort().slice(0, 20)) console.log(`  ${id}`);
  if (desconhecidas.length > 20) console.log(`  ... e mais ${desconhecidas.length - 20}`);
}

if (violacoes.length > 0) {
  const n = violacoes.length;
  console.error(`\nERRO: ${n} licença${n === 1 ? '' : 's'} proibida${n === 1 ? '' : 's'} em runtime:\n`);
  for (const { id, licenca } of violacoes.sort(porId)) console.error(`  ${id} — ${licenca}`);
  console.error(
    '\nCopyleft forte / cláusula de rede é incompatível com o modelo comercial\n' +
      'deste projeto. Ver docs/adr/0002. Se a licença foi analisada e é aceitável\n' +
      'no caso concreto, registre em EXCECOES neste arquivo com a justificativa.',
  );
  process.exit(1);
}

console.log('\nOK: nenhuma licença proibida em runtime.');
