# Folio

Folio é um ambiente desktop para escrever trabalhos acadêmicos sem separar a
escrita da pesquisa. O documento fica em Markdown, as referências usam
CSL-JSON e o projeto mantém os dados no próprio workspace.

O foco é simples: abrir um vault, escrever, acompanhar referências e entregar
o trabalho sem depender de uma plataforma online.

## O que já funciona

- Editor Markdown com preview, estrutura, diagnóstico e referências cruzadas.
- Citações e bibliografia em formato ABNT.
- Biblioteca CSL-JSON, PDFs, anotações e literature notes.
- Projetos de pesquisa, canvas, capturas, diário e revisão.
- Exportação para PDF, DOCX e HTML.
- Workspace local com busca, histórico e sincronização por pasta espelho.

## Rodar localmente

Requer Node 20.19 e pnpm.

```bash
pnpm install
pnpm --filter @abnt/desktop dev
```

Para verificar o repositório:

```bash
pnpm check
```

## Estrutura

- `apps/desktop`: aplicativo Electron.
- `apps/cli`: compilador pela linha de comando.
- `packages/`: modelo de documento, compilação, referências, workspace e UI.
- `examples/`: workspaces de demonstração.

O produto está em desenvolvimento. Linux x64 é o alvo de distribuição atual.
