# ADR 0056 — Busca booleana e descoberta acadêmica são projeções do vault

**Status:** aceito

## Contexto

A busca estruturada inicial combinava apenas predicados por conjunção. Isso
servia ao filtro rápido, mas não expressava perguntas usuais de pesquisa, como
documentos metodológicos **ou** qualitativos, ou documentos que citam mas não
possuem figuras. Quick Open também não é uma superfície apropriada para
inspecionar snippets, seções e aplicar ações sobre um conjunto de resultados.

## Decisão

- `@abnt/language-service` interpreta a consulta como AST booleana: `NOT`
  tem precedência sobre `AND` (explícito ou implícito), que tem precedência
  sobre `OR`; parênteses agrupam. Operadores só têm significado em maiúsculas
  para não transformar prosa comum em sintaxe.
- O planner conserva o caminho FTS5 ranqueado para conjunções já existentes;
  árvores com `OR`/`NOT` combinam conjuntos de `WorkspaceFileId` obtidos das
  mesmas projeções (`WorkspaceIndex`, metadata do host e storage abstrato).
  Nunca há SQL montado no renderer.
- O host decora um hit textual com a seção do outline indexado que o contém.
  A busca FTS encontra o documento; o `indexed_headings` decide a seção. Ler a
  autoria para localizar o trecho destacado é só uma decoração tolerante a
  corrida — não é parser no renderer nem uma nova fonte de verdade.
- A Search View recebe somente `WorkspaceSearchResultDto`, agrupa por seção e
  dispara abrir, abrir ao lado, collection, salvar busca e copiar link pelo
  único `CommandRegistry`. Collections e buscas salvas continuam estado
  operacional local.
- Menções não linkadas continuam sugestões. Título/heading de documento gera
  sugestão `document` que pode virar link; título ou autoria bibliográfica gera
  sugestão `reference` que pode virar citação. Nenhuma delas edita Markdown sem
  confirmação/`EditorTransaction`.
- Aliases não são inferidos de texto. Enquanto não existir formato autoral para
  declará-los, uma heurística seria uma falsa certeza; F74 cobre normalização de
  diacríticos, limites de palavra, headings, títulos e autores disponíveis no
  catálogo efetivo.

## Consequências

Busca acadêmica fica mais expressiva sem contaminar React com domínio, SQLite
com preferências ou Markdown com estado operacional. O resultado pode mostrar
uma seção apenas quando existe um hit textual localizável; filtros puramente
estruturais continuam resultados de documento, pois não há uma seção verdadeira
a inventar.
