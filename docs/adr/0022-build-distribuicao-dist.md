# ADR 0022 — Artefatos `dist` e condições de desenvolvimento

## Contexto

Os packages apontavam `exports` e os bins do CLI/LSP diretamente para `src`.
Isso funcionava com `tsx` no monorepo, mas não era uma distribuição Node
executável: um consumidor sem loader TypeScript não podia iniciar `abnt` ou
`folio-lsp`.

## Decisão

Cada package publicável declara dois destinos no mesmo export:

- condição `development` → `src/index.ts`, usada por TypeScript/Vitest/Vite no
  loop do monorepo;
- destino padrão → `dist/index.js`, usado por Node e por um package publicado.

`pnpm build` executa os builds em ordem topológica. CLI e LSP compilam para
`dist`, e seus campos `bin` apontam para `dist/bin.js` e `dist/server.js`.
O desktop mantém seu bundle próprio, mas entra no mesmo build e no smoke de
artefato. `pnpm test:distribution` confere os arquivos críticos, roda a ajuda
do CLI distribuído e faz `node --check` do LSP; EOF não é usado como falso
cliente LSP porque o protocolo corretamente o trata como sessão inválida.

O SQLite nativo do desktop é uma exceção deliberada ao compartilhamento de
`node_modules`: o build copia `better-sqlite3` para
`apps/desktop/dist/workspace/node_modules/` e o recompila contra os headers da
versão de Electron instalada. O Workspace Service inicializa explicitamente
esse addon privado antes de abrir o índice. Assim, o processo Electron resolve
o ABI dele, enquanto CLI, LSP e Vitest preservam o addon do Node do monorepo.
O artefato é o único dono dessa cópia; o build nunca recompila a cópia do store
do pnpm.

Comandos que executam source fora de Vite/Vitest usam
`NODE_OPTIONS=--conditions=development`, inclusive o filho de plugin com
`tsx`. A lista de `execArgv` dele continua fixa: não herdar flags do pai evita
a regressão de fork recursivo registrada no ADR 0020.

## Consequências

O loop local continua sem build prévio, enquanto um release tem entrada em JS
real e declarations em `dist`. `pnpm check:release` combina os gates usuais,
build topológico e smoke de distribuição. O dependency-cruiser resolve a
condição `development` de propósito: ele deve fiscalizar `src`, não os bundles
`dist` excluídos do grafo. Isto não escolhe ainda instalador, assinatura,
auto-update ou distribuição do Chromium. O build de desenvolvimento já produz
o addon do ABI do Electron local; o empacotamento de release ainda precisa
materializar essa etapa para cada plataforma/arquitetura na matriz de CI.
