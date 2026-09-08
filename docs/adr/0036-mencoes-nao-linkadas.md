# ADR 0036 — Backlinks 2.0: menções não linkadas como sugestão, nunca edição automática

**Status:** aceito · 2026-09-08

## Contexto

Backlinks (P11/ADR 0016) só encontra links explícitos. Um documento pode
mencionar o título de outro em prosa sem linká-lo — é um sinal útil para um
vault de conhecimento, mas editar o documento sozinho para "corrigir" isso
seria o tipo de mágica silenciosa que o projeto evita (ver a disciplina de
`preview`/`bibliography` no ADR 0017: nada consome dado derivado como "verdade
garantida" sem o usuário confirmar).

## Decisão

### Detecção via título indexado, não uma segunda passada de parsing

`WorkspaceIndex.documentTitles()` (`SELECT file_id, path, title FROM
document_fts`, sem `MATCH` — FTS5 aceita `SELECT` direto sobre a tabela
virtual) devolve o título de todo documento do vault; muda só quando arquivos
são criados/renomeados/retitulados, não a cada tecla.

`WorkspaceLanguageService.unlinkedMentions(fileId)`
(`packages/language-service/src/language-service.ts`) percorre o AST do
documento consultado (`percorrer`, já usado por outline/diagnostics) coletando
os `source` ranges de todo nó `link`/`citation` como "zonas excluídas" — e
então procura, no texto bruto, ocorrências (case-insensitive) dos títulos de
**outros** documentos. Uma ocorrência dentro de uma zona excluída (por
exemplo, o texto visível de um link que por coincidência repete o título) não
é sinalizada. Isso evita rastrear "está dentro de um link" durante o
percurso — `link`/`citation` guardam o span inteiro do Markdown autoral
(`[texto](destino)`/`[@id]`), então qualquer ocorrência dentro desse span já
está "linkada" por definição, sem precisar de contexto de pai na árvore.

Filtro de ruído: títulos com menos de 4 caracteres não geram sugestão (evita
falsos-positivos tipo "Introdução" batendo em qualquer heading homônima).

### Custo limitado ao documento ativo, sob demanda

A varredura roda só sobre o texto do documento aberto no editor
(`O(tamanho do documento × nº de títulos do vault)`), não em background
permanente sobre o vault inteiro — o painel de Backlinks só busca quando
está visível, atrás do mesmo modelo de revisão (`expectedRevision`) que
completion/hover/definição já usam (ADR 0027).

### Protocolo: revisionado como as demais consultas de linguagem

`LanguageUnlinkedMentionsRequest {fileId, expectedRevision}` →
`LanguageUnlinkedMentionDto[]`, seguindo exatamente o formato de
`LanguageCrossReferenceTargetsRequest` — resposta obsoleta por revisão é
descartada em `#languageQuery` (`workspace-service.ts`), igual ao resto do
language service.

### UI: extensão do painel de Backlinks, não um painel novo

"Backlinks 2.0" é literalmente isso — uma seção colapsável "Menções não
linkadas" dentro do `backlinksPanel` existente
(`apps/desktop/src/renderer/shell/panel-views.tsx`), fechada por padrão. Cada
sugestão tem um botão explícito "Transformar em link", que despacha o comando
`mention.linkify` (`targetMention: {range, text, targetPath}`) — uma
transação editorial (`{edits: [{range, text: '[texto](path)'}]}`), o mesmo
mecanismo que `citation.insert`/`xref.insert` já usam. Nada muda no documento
sem esse clique.

## Consequências

- `tests/f32-unlinked-mentions.test.ts`: uma ocorrência em prosa é sinalizada;
  a mesma string de título dentro de um link (`[Metodologia
  qualitativa](metodologia.md)`) NÃO gera uma segunda sugestão duplicada;
  revisão obsoleta após uma edição retorna `CONFLICT`.

## Não decidido aqui

Heurística de correspondência mais sofisticada que substring case-insensitive
(por exemplo, singular/plural, variação de artigo). Sugestão de link para
âncoras de seção, não só para o documento inteiro. Um teto de segurança
explícito para vaults muito grandes (hoje o escopo já limitado ao documento
ativo torna isso improvável de ser um problema, mas não foi medido).
