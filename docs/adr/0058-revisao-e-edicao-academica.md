# ADR 0058 — Revisão acadêmica como projeção operacional

**Status:** aceito · 2026-09-08

## Decisão

- Problems do vault inteiro é calculado pelo Workspace Service a partir das
  sessões/diagnósticos revisionados. O renderer recebe DTOs com arquivo,
  revisão, range, seção e regra; não recompila nem parseia Markdown.
- Filtros do modo de revisão e review comments são preferências operacionais
  locais, separados de Markdown, frontmatter e CSL-JSON. Um comentário ancora
  `fileId`, range e revisão para sinalizar naturalmente quando sua âncora pode
  estar desatualizada.
- Quick fixes usam o contrato `Diagnostic → CodeAction → WorkspaceEdit`. Só
  correções mecânicas, determinísticas e revision-safe aparecem (por exemplo,
  criar placeholders de legenda/fonte); decisões acadêmicas não viram botão.
- Modo de revisão combina as mesmas projeções de Problems e comentários. A
  navegação por diagnóstico/comentário é Command Registry, não atalhos diretos
  de componentes.

## Consequências

Problemas e comentários não criam outra autoridade editorial. O arquivo e a
sessão seguem sendo a fonte do rascunho; uma correção stale é recusada antes de
despachar a transação. Comparação arbitrária de documentos (F89) fica para a
próxima entrega: reutilizará text/structural diff do host, sem construir diff
no renderer.
