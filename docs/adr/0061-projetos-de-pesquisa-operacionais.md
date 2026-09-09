# ADR 0061 — Projetos de pesquisa operacionais

**Status:** aceito · 2026-09-09

## Decisão

- Um Research Project é estado operacional local por vault. Ele referencia
  `WorkspaceFileId`, IDs de referência, collections, buscas salvas e notas de
  literatura; não é uma pasta, não altera frontmatter e um membro pode aparecer
  em múltiplos projetos.
- Marcos, metas, deadline, profile alvo, outputs, checklist e arquivo do
  projeto também são operacionais. Arquivar só o remove das listas ativas;
  nunca move, renomeia ou apaga documentos e referências.
- O dashboard não recebe conteúdo Markdown no renderer. O Workspace Service
  recebe os FileIds e compõe palavras, revisão e diagnósticos a partir das
  sessões e da Language Service já existentes. Se a revisão mudar durante a
  projeção, aquela métrica é descartada.
- Fila de leitura, referências, profiles e collections permanecem donos dos
  seus próprios subsistemas. O projeto apenas aponta para eles e agrega suas
  projeções; não cria banco de analytics nem cópia canônica desses dados.

## Consequências

O usuário pode organizar TCC, artigo e projeto de pesquisa sobre os mesmos
arquivos sem duplicação. A remoção de um projeto não é uma operação destrutiva
sobre autoria. Futuras políticas de portabilidade/sync devem classificar este
estado explicitamente antes de sincronizá-lo; esta decisão não introduz cloud
nem servidor remoto.
