# ADR 0038 — Literature notes: citação real como vínculo, frontmatter como atalho

**Status:** aceito · 2026-09-08

## Contexto

O painel de Referências (P12) já lista, formata e insere citação. O próximo
passo natural — "criar uma nota de leitura a partir desta referência" — exigia
uma primitiva que não existia: `WorkspaceStorage` só sabia `write()` (exige
registro existente) e `rename()` (também exige); não havia "criar arquivo
novo que ainda não existe".

## Decisão

### `WorkspaceStorage.create()` é uma primitiva nova, não uma reforma de `write()`

`CreateWorkspaceFileRequest {path, content}` →
`LocalFilesystemStorage.create()` (`packages/workspace-local`): mesmo padrão
de checagem de colisão que `rename()` já usa (`lstat` + `WorkspaceAlreadyExistsError`
se existir), mesma escrita atômica (`#writeTextAtomically`) que `write()` já
usa, e o mesmo `#newRecord`/`#persistState` que o watcher usa para arquivos
criados externamente — por isso o arquivo criado aparece via
`workspace:file-created` no índice **sem nenhuma mudança adicional** em
`SqliteWorkspaceIndex` ou na lista de arquivos da UI: ambos já assinam esse
evento desde que existem.

Efeito colateral descoberto durante a implementação: `errorFor()` em
`apps/desktop/src/workspace/workspace-service.ts` não tratava
`WorkspaceAlreadyExistsError` — cairia em `INTERNAL` genérico. Isso já era um
bug latente para `rename()` também; corrigido junto (mapeia para `CONFLICT`),
porque F34 precisava do mapeamento correto de qualquer forma.

### O vínculo autoritativo é a citação real, não o frontmatter

```md
---
title: "<título>"
sourceReference: <referenceId>
---

# Notas de leitura — <título>

> Fonte: [@<referenceId>]

## Read
## Annotate
## Cite
## Write
```

`sourceReference:` no frontmatter é só um atalho de UI (existência O(1) de "já
tem nota?"); o vínculo que conta é a citação `[@id]` no corpo — reaproveita
busca estruturada (`cites:`, ADR 0033), Citation Explorer (ADR 0035) e grafo
(ADR 0034/0037) de graça, sem nenhuma indexação nova para "nota de leitura"
como conceito. Se o usuário apagar a citação do corpo mas deixar o
frontmatter, a nota some das projeções derivadas da citação mas continua
existindo como arquivo normal — comportamento aceitável, documentado aqui
para não ser "descoberto" de novo.

### Idempotente por path, não por contador de colisão

Caminho fixo `papers/{referenceId}.md`. Se já existe, o comando **abre a nota
existente** em vez de falhar ou sufixar (`-2.md` seria ruído — uma referência
tem uma nota). Título vem da bibliografia já resolvida do documento ativo
(`controller.snapshot().bibliography.entries[referenceId]`) — não resolve
bibliografia vault-wide só para isso, ao contrário do Citation Explorer.

### Comando, não uma segunda gravação direta de arquivo pela UI

`reference.createLiteratureNote` (`CommandRegistry`) chama
`window.academic.documents.createLiteratureNote({referenceId, activeFileId})`
e abre o resultado — o painel de Referências ganhou um terceiro botão ("Criar
nota de leitura") ao lado de "Inserir citação"/"Abrir fonte", mesmo padrão de
nunca tocar storage direto da UI.

## Consequências

- `tests/f34-literature-notes.test.ts`: cria a nota, valida conteúdo
  (frontmatter + corpo), valida idempotência (segunda chamada devolve o mesmo
  `fileId`), valida que `activeFileId` inexistente retorna `NOT_FOUND`, e que
  o arquivo aparece via evento sem sincronização manual.

## Não decidido aqui

Template de literature note customizável (hoje é fixo). Colisão de
`referenceId` com caracteres verdadeiramente hostis a filesystem além do
conjunto sanitizado (`/ \ : * ? " < > |`) — improvável em chaves BibTeX/CSL
reais, não testado a fundo.
