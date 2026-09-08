# ADR 0052 — Transclusão é expansão de fonte pelo host

**Status:** aceito

## Contexto

Um trabalho longo precisa ser escrito em capítulos independentes, mas publicado
como um documento único. Transformar inclusão em um nó específico do
`document-model` faria o núcleo conhecer caminhos, autoridade de leitura e
ciclo de vida de arquivos — conceitos que não são verdadeiros sobre um
documento genérico.

## Decisão

- `[texto](arquivo.md)` continua sendo um link normal. Só `![[arquivo.md]]`
  incorpora o corpo de outro Markdown; `![[arquivo.md#Seção]]` incorpora uma
  seção identificada pelo seu heading.
- O host expande embeds antes de chamar o parser/compiler. A Document AST,
  semântica, profiles e renderers recebem Markdown ordinário já composto.
- O rascunho persistido nunca é reescrito. A fonte expandida é virtual e só
  existe durante uma compilação revisionada; o hash da sessão continua sendo o
  da autoria original.
- O expansor é puro e recebe um leitor injetado. Workspace e CLI são os únicos
  adaptadores que fornecem leitura; URIs relativas de módulos são rebased para
  a raiz e nunca viram `file://` no documento.
- Frontmatter de módulos não se funde com o da raiz. Profile, metadata e
  bibliografia canônicos pertencem ao documento que o usuário publica.
- Ciclos, alvo ausente, seção ausente, URI externa e profundidade excessiva
  produzem diagnostics estáveis, sem expandir parcialmente de forma silenciosa.

## Consequências

TCCs modulares são apenas uma raiz `index.md` com capítulos Markdown normais.
O preview, PDF e DOCX publicam a composição; o editor continua abrindo cada
arquivo individualmente. Source ranges de conteúdo transcluído pertencem à
fonte virtual nesta primeira versão, portanto edição/refactor cross-file não é
inferida a partir deles — essa capacidade exige um source map explícito em
marco futuro.

**Atualização (Onda O):** esse source map é o `CompositeSourceMap` de F66/ADR
0054, que traduz diagnósticos do compiler de volta ao arquivo real. Rename
cross-file (F69) acabou não precisando dele — ver ADR 0055.
