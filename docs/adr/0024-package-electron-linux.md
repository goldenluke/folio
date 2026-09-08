# ADR 0024 — Package Electron Linux do Folio

**Status:** aceito · 2026-09-08

## Contexto

P17 produz bundles `dist` e P18 produz uma cópia privada de `better-sqlite3`
para o ABI exato do Electron em Linux x64. Faltava transformar esse runtime em
um aplicativo que rode fora do checkout, sem `tsx`, `pnpm`, sources do monorepo
ou o binding compilado para o Node dos testes.

O primeiro recorte de packaging continua propositalmente pequeno: não há
assinatura, instalador, update ou publicação de artefatos. A meta é provar um
diretório de aplicativo reprodutível e testável em máquina limpa.

## Decisão

### Ferramenta e formato

Usamos `electron-builder` para produzir `linux-unpacked` em Linux x64:

```text
apps/desktop/release/linux-unpacked/
```

O pacote usa `asar: true`. `electron-builder` foi escolhido porque fornece
ASAR, recursos externos e o target `dir` agora, preservando a continuidade
para os formatos Linux de P20. Electron Forge também suporta unpack de módulos
nativos, mas acrescentaria a camada de makers sem resolver melhor o staging
privado; Electron Packager é mais baixo nível e deixaria a composição futura de
artefatos por conta do projeto.

Este ADR não escolhe `.deb`, AppImage, RPM, signing ou auto-update.

### Staging fechado antes do package

`pnpm --filter @abnt/desktop package:linux` faz, nesta ordem:

```text
build:native (P18)
  ↓
stage temporário de produção
  ↓
electron-builder --linux dir --x64
  ↓
release/linux-unpacked
```

O stage contém apenas os bundles compilados e dependências runtime necessárias
para PDF/DOCX. `@abnt/*`, TypeScript, `tsx`, Vite, Electron Builder e os
demais devDependencies não são dependências do aplicativo final. O stage é
temporário e removido mesmo quando o package falha.

### SQLite fora do ASAR, com dono único

O Workspace Service e sua cópia P18 de `better-sqlite3` são copiados para:

```text
resources/workspace-runtime/
```

incluindo `native-addon.json`. No package, o Electron Main inicia o utility
process a partir dessa raiz externa; portanto tanto a validação explícita
quanto o `require('better-sqlite3')` que o índice usa encontram a mesma cópia
Electron-específica. Não dependemos de smart-unpack implícito nem da cópia Node
que existe no checkout para CLI/testes.

Essa decisão não muda as fronteiras: Main ainda apenas supervisiona, o
Workspace Service segue sendo o único dono de filesystem/SQLite e o Renderer
continua sem acesso a ambos.

### Smoke do artefato

`pnpm --filter @abnt/desktop smoke:package` lança o binário empacotado, sobre
um vault temporário, e exige:

```text
abrir vault → SQLite/FTS → abrir editor → editar → salvar → reabrir
           → busca → preview → PDF → DOCX
```

O teste confere os arquivos persistidos e as assinaturas `%PDF-` e `PK`.
Ele é a prova de que o package não depende de Node/`tsx`/fontes locais para
executar o fluxo do produto.

## Consequências

- Linux x64 tem agora um artefato executável não assinado, além do build P18.
- O Workspace Service é um recurso de runtime externo ao ASAR por causa do
  addon; os demais bundles permanecem no ASAR.
- O CI Linux executa também o package e seu smoke após os gates de release e
  do addon nativo.
- A versão de Electron e o addon P18 continuam acoplados pela validação do
  manifesto; atualizar um exige recompilar e smokar o package.

## Não decidido aqui

Formatos instaláveis Linux, versão/release channel, assinatura, SBOM, scan de
vulnerabilidades, auto-update, Windows, macOS e arm64. Cada target adicional
continua exigindo ADR e runner nativo próprios, conforme ADR 0023.
