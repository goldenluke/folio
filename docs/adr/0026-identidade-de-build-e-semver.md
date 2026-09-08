# ADR 0026 — SemVer e identidade pública de build do Folio

**Status:** aceito · 2026-09-08

## Contexto

P18–P20 já geram um executável e um instalador Linux, mas a pessoa que recebe
um erro ainda não consegue identificar com precisão qual binário está rodando.
Versão de pacote sozinha não informa a revisão do código, o canal, o runtime
Electron nem a compatibilidade dos contratos e dados persistidos.

P21 (signing/notarização) foi explicitamente adiado: não há credenciais ou
infraestrutura de deploy nesta decisão.

## Decisão

### SemVer do produto

O Folio usa [SemVer](https://semver.org/) para o produto distribuído. A primeira
linha de desenvolvimento é `0.1.0-dev.0`:

- `0.x.y` comunica API/produto ainda em evolução;
- `-dev.N` identifica builds de desenvolvimento;
- os únicos canais permitidos são `development`, `preview` e `stable`;
- uma alteração incompatível de protocolo, schema persistido ou API de plugin
  continua incrementando seu próprio número de versão, além da versão do
  produto quando ela chegar ao usuário.

O `package.json` de cada host distribuível (desktop, CLI e LSP) acompanha a
versão de produto. Packages internos preservam seus próprios contratos e não
ganham uma falsa promessa de versionamento público independente.

No `.deb`, o `electron-builder` traduz o hífen de prerelease para `~` (por
exemplo, `0.1.0-dev.0` → `0.1.0~dev.0`), que é a ordenação correta do Debian.
O arquivo do pacote conserva a versão SemVer legível no seu nome.

### Manifesto de identidade

Todo build do desktop escreve `apps/desktop/dist/build-info.json` antes de ser
empacotado. O mesmo arquivo segue para o stage, ASAR e `.deb`. Ele é um DTO
validado por `@abnt/protocol` e contém somente:

```text
produto, versão, commit, canal, plataforma, arquitetura, Electron,
protocolo, schemas de configuração/estado/índice e API de plugins
```

`FOLIO_GIT_COMMIT` (ou `GITHUB_SHA`) é usado no CI; localmente o valor explícito
é `unavailable`. `FOLIO_BUILD_CHANNEL` aceita apenas os três canais fechados.
Build inválido falha antes de abrir a janela.

O manifesto nunca inclui caminho, id, conteúdo, título ou metadados de vault.
Não é telemetria e não é uma fonte de estado operacional.

### Superfície do produto

O Main lê e valida o manifesto e oferece `application.systemInformation()` pela
API capability-based do preload. O renderer não lê arquivos nem `process`;
apenas apresenta o DTO em **Ajuda → Informações do sistema**. A chamada não
entra no protocolo de Workspace porque é identidade do aplicativo, não
operação sobre o vault.

## Consequências

- suporte recebe uma identidade comparável de qualquer build distribuído;
- a CI carimba o commit e canal sem usar segredo de signing;
- schemas do workspace agora exportam suas versões canônicas, em vez de a
  interface mostrar literais espalhados;
- o artefato Linux continua não assinado e não publicado. P23 define workflow
  de release somente quando houver autoridade operacional para isso.

## Não decidido aqui

Tags, publicação de artefatos, assinatura, notarização, repositório APT,
auto-update, SBOM, crash reporting e política de retenção de logs.
