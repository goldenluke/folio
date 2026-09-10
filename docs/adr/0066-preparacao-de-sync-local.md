# ADR 0066 — Preparação de sync local-first

**Status:** aceito · 2026-09-09

## Decisão

- A Onda W não implementa servidor, contas, OAuth, billing, CRDT ou transporte
  de rede. Ela define somente a costura que um adapter futuro deverá cumprir.
- Cada estado conhecido recebe uma política fechada: autoria (`vault-content`),
  operacional portátil (anotações, fila de leitura, projetos, collections,
  buscas, metas, comentários, snapshots, inbox e registros de submissão),
  preferência de máquina (recência, layout, foco, atalhos, onboarding) ou
  projeção reconstruível (SQLite/FTS, preview, grafo, estatísticas e
  diagnósticos). Um novo estado não se torna sincronizável por acidente.
- `PortableWorkspaceState` é um envelope JSON versionado para entradas
  operacionais portáteis. Ele não usa SQLite como persistência canônica, não
  contém Markdown e não substitui `workspace-state.json`, que continua sendo
  a identidade operacional do adaptador local.
- `WorkspaceStorageCapabilities` declara escrita/rename atômicos, watch,
  leitura/escrita binária, conditional write e comparação de revisão. Código
  consumidor pergunta pela capability; não usa `instanceof
  LocalFilesystemStorage` para tomar decisão de domínio.
- Conflitos são tipados: texto, referência, annotation, projeto, collection,
  workspace state, delete/edit e rename/edit. Apenas texto oferece a opção de
  **merge manual**; os demais exigem revisão da entidade. Não há resolução
  automática por text merge de CSL-JSON ou estado operacional.
- `WorkspaceSyncAdapter` declara `list/read/write` e, conforme capabilities,
  `rename/delete/compareRevision/subscribe/poll`. `InMemoryWorkspaceSyncAdapter`
  prova dois devices, conditional writes, replicação e conflitos sem rede.

## Consequências

O filesystem continua a fonte de verdade e `Document AST` continua totalmente
alheia a sync. Um futuro adapter remoto precisará respeitar os contratos e
escolher uma política de autenticação, transporte e armazenamento em ADR
próprio; esta decisão não autoriza implementar cloud.
