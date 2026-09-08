# ADR 0008 — Workspace local-first com identidade fora do path

**Status:** aceito · 2026-09-07

## Contexto

O editor será um cliente de um vault que também pode ser alterado por Git, Vim,
VS Code, sincronizadores e processos externos. Usar o path como identidade
quebra abas, sessões, backlinks e cache na primeira renomeação. Usar SQLite
como fonte dos arquivos romperia a promessa local-first: Markdown deixaria de
ser utilizável sem a aplicação.

## Decisão

`@abnt/workspace-core` define o domínio e a interface `WorkspaceStorage`; não
importa Node, protocolo, compiler ou UI. `@abnt/workspace-local` implementa a
interface para um diretório local e mantém somente metadados operacionais em:

```text
vault/
├── artigo.md                     ← conteúdo autoral, fonte da verdade
└── .academic/
    ├── workspace-config.json     ← configuração declarada pelo usuário
    ├── workspace-state.json      ← FileId, DocumentId, hash e revisão
    └── recovery/                 ← journals curtos de escrita pendente
```

Cada arquivo tem `WorkspaceFileId` estável; Markdown recebe também um
`WorkspaceDocumentId` estável. O path é apenas uma propriedade mutável. A API
de rename preserva ambos. Para renomeações externas, a reconciliação associa de
volta um arquivo ausente e um novo path somente quando seu hash é único; se for
ambíguo, é preferível criar uma nova identidade a acertar silenciosamente a
errada.

Escritas seguem esta ordem:

```text
recovery record fsync → arquivo temporário fsync → rename atômico → state fsync → remover journal
```

Na abertura, o journal é aplicado se o destino ainda possui o hash-base, é
descartado se o hash novo já está no disco e é preservado para inspeção se há
conflito. Antes de cada write/rename, o adaptador relê o hash do arquivo; uma
alteração externa causa `WorkspaceConflictError`, nunca sobrescrita silenciosa.

`fs.watch` não é exposto aos consumidores. Seus sinais ruidosos são agrupados
e convertidos por uma reconciliação de snapshots em eventos semânticos de
criação, alteração, remoção ou rename. Há fallback para watchers por diretório
quando o watcher recursivo não é suportado.

## Consequências

- Markdown e assets permanecem portáveis; excluir `.academic` não apaga o
  conteúdo, embora faça a aplicação reconstruir identidades novas.
- P3 poderá tratar SQLite como índice descartável, sem competir com o vault.
- P4 poderá usar `revision` e `contentHash` para rejeitar compilações antigas.
- Sincronização e storage criptografado podem implementar o mesmo contrato sem
  alterar editor ou compiler.
