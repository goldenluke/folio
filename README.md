# Folio

Folio é um compilador de documentos acadêmicos. Markdown como linguagem de autoria, ABNT
como camada de regras sobre um modelo semântico genérico.

```bash
folio build artigo.md --format pdf
folio lint  artigo.md
```

## Estado

**M5 + P0–P22 + Onda A de features concluída** — além dos profiles `abnt-artigo` e `web-article`, o profile
`abnt-tcc` gera os elementos externos, internos e pós-textuais de um trabalho
acadêmico, incluindo listas e sumário com páginas reais. O compiler headless
agora separa a AST autoral do ambiente de compilação. Os três fluxos têm
regressão visual PDF/PNG. Ver
[docs/ROADMAP.md](docs/ROADMAP.md) e o recorte honesto de escopo em
[docs/ABNT.md](docs/ABNT.md).

O desktop também oferece autocomplete de citações/links, hover e navegação de
definições/referências sobre o mesmo language service usado pelo LSP, Command
Palette (`Ctrl/Cmd+Shift+P`) e Quick Open (`Ctrl/Cmd+P`) sobre o vault indexado.
A trilha
O editor inclui picker de citação (`Ctrl/Cmd+Shift+C`) e edição por clique,
sempre gravando Markdown em vez de estado proprietário.
Também inclui metadados YAML visuais, referências cruzadas persistidas e um
centro acadêmico de diagnósticos.
de deploy permanece congelada após P22 para priorizar features de uso diário.

## Instalação Linux (experimental)

O artefato Linux x64 atual é um `.deb` não assinado para Debian/Ubuntu e
derivadas. Após obter o arquivo de release:

```bash
sudo apt install ./folio_*.deb
```

Ele instala o comando `folio` e o launcher do menu de aplicações. Signing,
repositório APT e auto-update ainda não existem; ver
[ADR 0025](docs/adr/0025-instalador-debian-linux.md).

Em **Ajuda**, o aplicativo mostra a identidade pública da build (versão,
commit, canal, runtime e schemas), sem revelar conteúdo ou caminhos do vault.

## Como funciona

```
SourceSnapshot + Compilation Environment → Document AST → ResolvedDocument → Publication AST → HTML → PDF
```

A ideia central: o **Document AST não conhece a ABNT**. Ele descreve o que o
documento significa — isto é uma seção, isto é uma citação, isto referencia
aquela figura — e nunca como deve aparecer. A norma entra depois, como
consumidora do modelo, o que permite publicar o mesmo texto sob ABNT, APA ou o
padrão de um periódico sem tocar no núcleo.

Consequência prática: número de seção não é escrito pelo autor nem guardado na
árvore. `# Introdução` vira `1 INTRODUÇÃO` porque um passe de numeração calcula
isso, e outra norma calcularia diferente a partir da mesma fonte.

Bibliografia externa e recursos locais também não são incorporados à AST: o
host (hoje o CLI) constrói um `CompilationEnvironment`, e o compiler resolve a
unidade sem fazer I/O ou renderizar HTML/PDF.

Detalhes em [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Desenvolvimento

```bash
pnpm install
pnpm check     # typecheck + fronteiras + licenças + testes
pnpm test:visual # PDF → PNG comparado aos baselines aprovados

NODE_OPTIONS=--conditions=development pnpm exec tsx apps/cli/src/bin.ts build fixtures/artigo/artigo.md --format pdf
NODE_OPTIONS=--conditions=development pnpm exec tsx apps/cli/src/bin.ts build fixtures/completo/completo.md --format pdf
NODE_OPTIONS=--conditions=development pnpm exec tsx apps/cli/src/bin.ts build fixtures/m2/artigo.md --format pdf
NODE_OPTIONS=--conditions=development pnpm exec tsx apps/cli/src/bin.ts build fixtures/m4/artigo.md --format pdf
NODE_OPTIONS=--conditions=development pnpm exec tsx apps/cli/src/bin.ts build fixtures/m5/tcc.md --format pdf
NODE_OPTIONS=--conditions=development pnpm exec tsx apps/cli/src/bin.ts lint  fixtures/m5/tcc.md
```

Requer Node ≥ 20.19 e um Chromium instalado (`ABNT_CHROME` para apontar outro).

## Licença

Proprietário. O gate `pnpm check:licenses` impede a entrada de dependências
copyleft forte em runtime — ver
[docs/adr/0002](docs/adr/0002-motor-de-citacao-proprio.md) para o caso concreto
que motivou isso.
