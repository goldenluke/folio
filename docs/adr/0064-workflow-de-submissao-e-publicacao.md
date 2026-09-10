# ADR 0064 — Workflow de submissão e publicação

**Status:** aceito · 2026-09-09

## Decisão

- Submission Target, presets, checklist, snapshots e publication records são
  estado operacional local do Project. Eles não escrevem frontmatter, não
  duplicam Markdown e não transformam o vault em banco de publicação.
- O preflight compõe somente projeções que já existem: Project Dashboard
  revisionado (diagnósticos e estatísticas estruturais) e Reference Health.
  Portanto ele apresenta preparação para entrega, mas não cria uma segunda
  gramática ou um validador independente no React.
- Um snapshot final é criado por arquivo antes da exportação. O registro
  armazena o id do snapshot, a revisão e o hash da fonte **autoral**. O hash
  de fonte expandida/virtual nunca é usado como identidade de submissão.
- Main calcula SHA-256 do byte/texto que acabou de gravar fora do vault e
  devolve o valor validado pelo protocolo junto da revisão, do profile e do
  hash autoral que produziram o artefato. PDF, DOCX e HTML continuam no Export
  Service; Main limita-se ao diálogo nativo e à gravação do destino.
- Um artefato só entra no record se revisão e hash ainda coincidirem com o
  snapshot. Caso a autoria tenha mudado, o usuário executa novamente preflight
  e snapshot em vez de associar um PDF novo a uma versão antiga.

## Consequências

É possível responder qual autoria, profile e artefato pertencem a uma
submissão sem guardar uma segunda cópia do manuscrito. Arquivos suplementares
não são inventados pelo workflow: permanecem autoria já vinculada ao projeto e
o usuário os confirma no checklist. O renderer continua sem filesystem,
SQLite, parser Markdown ou Publication AST própria; ele recebe DTOs e inicia
comandos já autorizados.
