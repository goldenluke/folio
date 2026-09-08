# ADR 0023 — Matriz nativa inicial: Linux x64

**Status:** aceito · 2026-09-08

## Contexto

P17 já gera os bundles do desktop e uma cópia privada de `better-sqlite3`,
recompilada para o ABI do Electron. Essa cópia resolve o problema local, mas
não definia de onde viria o addon de cada artefato distribuído nem como impedir
reuso de um `.node` compilado para runtime incompatível.

P18 inicia a operação de release com uma matriz deliberadamente pequena. O
produto se chama **Folio**; os identificadores técnicos `@abnt/*` permanecem
internos e não são alterados por esta decisão.

## Decisão

### Target oficial inicial

| Tier | SO | Arquitetura | Runner de build |
| --- | --- | --- | --- |
| 1 | Linux | x64 | GitHub Actions `ubuntu-22.04` x64 |

`linux-arm64`, Windows e macOS não são targets de P18. Cada um exigirá uma
decisão de produto e uma expansão explícita deste ADR antes de receber artefato
ou promessa de suporte.

`ubuntu-22.04` é usado como base nativa estável, em vez de cross-compilation.
O addon é compilado no mesmo SO e arquitetura que o executará. O requisito de
glibc e a distribuição Linux final serão definidos em P19/P20 junto do formato
de package/installer; P18 ainda não declara AppImage, deb ou outro formato.

### Build nativo, não prebuild publicado

O primeiro target recompila `better-sqlite3` no runner limpo usando os headers
da versão exata de Electron instalada pelo lockfile. Não publicamos prebuild
genérico nem mutamos o store compartilhado do pnpm.

O build continua a fazer:

```text
node_modules/better-sqlite3 (ABI Node, CLI/testes)
                 ≠
apps/desktop/dist/workspace/node_modules/better-sqlite3 (ABI Electron)
```

Somente a segunda cópia é removida, montada e passada ao `node-gyp`.

### Identidade, cache e armazenamento

Cada addon tem `native-addon.json` ao lado do Workspace Service. O manifesto
registra plataforma, arquitetura, versão de Electron, `NODE_MODULE_VERSION`,
versão de `better-sqlite3`, hash do lockfile e a chave derivada.

Formato da chave:

```text
folio-native-linux-x64-electron-<version>-sqlite-<version>-abi-<abi>-lock-<hash>
```

O cache local fica em `apps/desktop/.native-cache/<chave>/better_sqlite3.node`
e é ignorado pelo Git. No CI, esse diretório é cacheável pela mesma chave e o
addon também é publicado como artefato efêmero de auditoria. Cache é apenas
aceleração: cache miss recompila; cache hit nunca cruza plataforma, arquitetura,
Electron, ABI, versão do addon ou lockfile.

Artefato de release e repositório de downloads ainda não existem em P18; a
política durável de publicação pertence a P19/P23.

### Validação de ABI

Antes de abrir o índice, o Workspace Service lê o manifesto e compara:

- `process.platform` e `process.arch`;
- `process.versions.electron`;
- `process.versions.modules`.

Uma divergência falha explicitamente antes de carregar SQLite. Isso complementa
o teste definitivo: abrir `new Database(':memory:')` com o binding privado no
runtime Electron real. `require('better-sqlite3')` isolado não é aceito como
smoke.

### Smoke de runtime

`pnpm --filter @abnt/desktop smoke:native` inicia o Electron construído sobre
um vault temporário e exige o fluxo real:

```text
Workspace Service → SQLite/migration → índice/FTS → editor → preview → PDF
```

Ele também confere o `index.sqlite`, a pesquisa FTS e a assinatura `%PDF-` do
arquivo exportado. O processo usa a cópia privada do addon, portanto cobre a
resolução de módulos e ABI que os testes in-process não alcançam.

### Packaging posterior

P18 não escolhe Electron Forge, electron-builder ou package próprio. A escolha
precisa ser tomada em ADR P19, contra suporte a ASAR, utility processes,
recursos extras, addon nativo e os formatos Linux então escolhidos.

## Consequências

- O primeiro CI nativo é uma matriz de um item, reproduzível em Linux x64.
- Versão de Electron passa a ser parte material da identidade do addon, não
  somente uma dependência transitiva.
- Um upgrade de Electron, `better-sqlite3` ou lockfile força cache novo e
  validação em runtime.
- O binding Node do monorepo permanece independente e íntegro para CLI, LSP e
  testes.
- Windows, macOS e Linux arm64 seguem conscientemente fora do suporte inicial.

## Não decidido aqui

Package, installer, signing, notarização, canais de atualização, repositório
de artefatos de release e estratégia de Chromium/PDF. Nenhuma dessas decisões
é necessária para provar a matriz nativa inicial e nenhuma entra no núcleo
semântico.
