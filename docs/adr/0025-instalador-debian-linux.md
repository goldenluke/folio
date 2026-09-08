# ADR 0025 — Instalador Debian Linux do Folio

**Status:** aceito · 2026-09-08

## Contexto

P19 já produz `linux-unpacked` e prova que o aplicativo Electron funciona fora
do modo de desenvolvimento. Um diretório não é, porém, a experiência de
instalação de um usuário Linux: não registra launcher, metadados de sistema ou
ícone e é fácil de mover/deletar acidentalmente.

O target oficial continua sendo Linux x64, construído nativamente em
`ubuntu-22.04` (ADR 0023). P20 precisa escolher um formato de instalação sem
fingir suporte para todas as distribuições Linux.

## Decisão

### Um único formato: `.deb`

O primeiro instalador é um pacote Debian:

```text
apps/desktop/release/folio_<versão>_amd64.deb
```

Ele atende Debian, Ubuntu e derivadas e é instalável por `apt install` ou
`dpkg -i`. AppImage, RPM, Flatpak, Snap e outros formatos não são produzidos
neste marco. A escolha acompanha o runner Ubuntu Tier 1 e reduz a superfície
de compatibilidade antes de haver telemetria e suporte operacional.

O instalador é deliberadamente **não assinado**. Signing, repositório APT e
auto-update pertencem às decisões posteriores de P21+.

### Conteúdo e metadados

`electron-builder` monta o `.deb` a partir do mesmo stage P19, sem executar
`node-gyp` ou depender de `tsx` no computador do usuário. O pacote declara:

- `Package: folio`, `Architecture: amd64`, seção Debian `editors` e prioridade
  `optional`;
- homepage oficial `https://goldenluke.github.io/folio`;
- dependências de bibliotecas gráficas Electron fornecidas pelo builder;
- launcher `folio.desktop`, com `StartupWMClass=Folio` e categorias Office;
- ícones PNG locais do Folio nas resoluções 64, 128, 256 e 512;
- a mesma raiz privada `resources/workspace-runtime` do P19, incluindo o
  manifesto e o binding Electron de SQLite.

O ícone é desenhado como SVG versionado no repositório e convertido para os
PNGs de instalação. Não é uma fonte de verdade documental nem parte do kernel.

### Smoke de instalação sem privilégios

`pnpm --filter @abnt/desktop smoke:installer` não instala no sistema do runner.
Em vez disso, extrai o `.deb` em uma raiz temporária via `dpkg-deb --extract`,
confere os control fields, launcher, ícones e executável, e lança
`/opt/Folio/folio` dessa árvore.

O runtime do smoke recebe somente `HOME`, `LANG`, `DISPLAY` e
`PATH=/usr/bin:/bin`: não herda `NODE_OPTIONS`, `pnpm`, `tsx` ou o cwd do
checkout. Em seguida exige o mesmo fluxo P19:

```text
vault → SQLite/FTS → editar → salvar → reabrir → busca → preview → PDF → DOCX
```

Isso não substitui uma VM/host limpo de release, mas verifica a estrutura e a
execução do artefato instalado sem mutar a máquina de desenvolvimento. Um teste
em imagem limpa sem Node/toolchain entra em P29.

## Consequências

- Há um formato instalável concreto para o único target oficial atual.
- O CI Linux gera e smoke-testa tanto `linux-unpacked` quanto o `.deb`.
- O aplicativo aparece no menu de desktop com identidade Folio, em vez do
  ícone padrão do Electron.
- Não há suporte anunciado para sistemas RPM, AppImage ou arquiteturas além de
  x64; não confundir um `.deb` não assinado com uma release pública.

## Não decidido aqui

Assinatura de pacote/código, repositório APT, workflow de release,
AppImage/RPM/Flatpak, Windows/macOS, SBOM, vulnerabilidades, update e teste em
VM limpa. Essas escolhas continuam separadas para não congelar política de
distribuição cedo demais.
