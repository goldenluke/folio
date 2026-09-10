# ADR 0078 — Attachment Model 2.0

## Contexto

O modelo de anexo original (F35, `references/attachments.json` v1) prendia
cada referência a um único PDF: um `fileId`/`path` por `referenceId`, sem
papel, título de exibição, versão ou tipo além de `application/pdf`. O
horizonte Zotero-inspired (Onda BF–BP) exige suportar manuscrito + material
suplementar + dataset no mesmo item bibliográfico, anexos por link (sem cópia
local) e histórico de versão — sem transformar o anexo em fonte de verdade
bibliográfica (isso continua sendo o CSL-JSON de `library.json`).

## Decisão

`@abnt/attachment-model` (pacote novo, folha, sem dependências) define o
formato v2: `Attachment` tem `id` (`AttachmentId` de marca), `role`
(`primary`/`supplementary`/`dataset`/`snapshot`), `kind` (`file`/`link`),
`displayTitle` opcional e uma lista de `versions` — nunca uma única
localização. Uma referência pode ter múltiplos `Attachment`, inclusive mais de
um com o mesmo papel (dois materiais suplementares, por exemplo).

`migrateAttachmentManifest`/`parseAttachmentManifest` fazem a migração
versionada: um manifesto v1 vira um `Attachment` `primary` com uma versão só,
preservando `fileId`/`path`/`mediaType` originais sem perda; uma entrada
individual corrompida no v2 é descartada na leitura, não derruba o manifesto
inteiro — mesma postura defensiva já usada pelo `readReferenceAttachments`
anterior. `checkAttachmentHealth` é puro: recebe do host quais `fileId`
existem no vault e quais `referenceId` continuam na biblioteca, e só então
aponta anexo órfão ou arquivo ausente — o pacote nunca toca filesystem.
`suggestAttachmentFilename` é só sugestão determinística (slug de
sobrenome-ano-título); a escrita do nome final continua decisão humana.

Anexo de link pode registrar um `snapshotText`, mas `sanitizeSnapshotHtml`
reduz qualquer HTML capturado a texto puro antes de entrar no manifesto —
remove `<script>`, `<style>`, comentários e toda marcação. Não existe
caminho, neste pacote ou em qualquer consumidor futuro, para persistir ou
renderizar o HTML original de uma captura como HTML executável. Isso
antecede a Onda BN (Scholarly Web Capture 2.0): quando um extractor real
existir, ele preenche este mesmo campo, já sob a mesma restrição.

A integração de produto (protocolo `workspace/*`, IPC/preload e UI) foi
entregue na mesma revisão, diferente de BF (`@abnt/scholarly-identifiers`) e
BG (`@abnt/pdf-reconciliation`), que pararam no pacote puro. `apps/desktop/
src/workspace/reference-attachments.ts` foi reescrito para ler/escrever v2
via `@abnt/attachment-model`; as funções legadas
(`readReferenceAttachments`/`setReferenceAttachment`/
`removeReferenceAttachment`/`moveReferenceAttachment`) continuam com a
mesma assinatura, agora implementadas sobre o manifesto v2 (o papel
`primary` é "o" anexo do mundo v1) — F35/F36 não mudaram uma linha de
código e continuam verdes. `moveReferenceAttachment` (merge/rename de
referência) passou a mover TODO anexo da duplicata, não só o PDF principal,
via `retargetAttachments`: quando a canônica já tem um anexo do mesmo
papel+tipo, o dela é preservado e o da duplicata é descartado — generalização
direta da regra de "quem já tem, mantém" que o v1 só aplicava porque só
existia um slot possível.

Sete métodos novos em `WorkspaceMethod`/`DesktopWorkspaceService`
(`attachments`, `addAttachment`, `addAttachmentVersion`, `removeAttachment`,
`renameAttachmentFile`, `attachmentLocalPath`, `attachmentHealth`) passaram
pelos quatro lugares da armadilha de protocolo já documentada em AGENTS.md
(model.ts, schemas.ts — incluindo o `z.enum([...])` do envelope —,
workspace-transport.ts e o barril index.ts). `WorkspacePickAttachmentRequest`
é a exceção: só viaja entre preload e Main (diálogo nativo de arquivo), nunca
cruza o MessagePort até o Workspace Service, então não entra no
`WorkspaceMethod`. Snapshot de link é o único campo (`snapshotText`)
sanitizado por `sanitizeSnapshotHtml`; a UI (`ReferenceLibraryDialog` em
`apps/desktop/src/renderer/app.tsx`) mostra múltiplos anexos por referência
com papel, versão, sugestão de renomeação como ação explícita (nunca
automática) e saúde agregada no `ReferenceHealthDialog`.

## Consequências

`references/attachments.json` muda de formato, mas nenhum vault existente
perde anexo: a leitura migra v1 automaticamente e nunca escreve v1 de volta —
confirmado por teste de integração que escreve um manifesto v1 direto no
disco e lê de volta em v2 (`tests/f436-attachment-protocol.test.ts`). Ficou
fora de escopo, deliberadamente: abrir link em navegador externo (a UI só
oferece copiar o link, para não introduzir `shell.openExternal` sobre dado do
vault sem desenho de segurança dedicado) e qualquer extractor real de
snapshot de página (isso é Onda BN). Ambos reaproveitam os mesmos campos do
modelo quando chegarem.
