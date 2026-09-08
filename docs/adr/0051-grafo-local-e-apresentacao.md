# ADR 0051 — Grafo local e layout são projeções, não dados do vault

**Status:** aceito

## Contexto

O grafo introduzido em F5 já é derivado de documentos, índice e bibliografia.
Para que ele seja útil no dia a dia, o usuário precisa reduzir o ruído por tipo,
abrir o entorno do documento em edição e localizar relações sem transformar a
visualização em uma nova fonte de verdade.

## Decisão

- Tags entram como nós `tag` e arestas `tagged-with`, produzidos pelo
  `Workspace Service` a partir da mesma projeção de frontmatter/corpo usada por
  F41. Essa varredura é opt-in em `workspace.graph`.
- `focusFileId` e profundidade 1/2 reduzem o grafo já derivado por BFS não
  direcionado. Não existe tabela de grafo, cache persistente ou método de
  resolução alternativo.
- O renderer filtra tipos, busca por label/path/chave, destaca seleção e abre
  documentos somente por DTO. Ele não lê filesystem, SQLite nem reinterpreta
  Markdown.
- O layout force-directed é uma função determinística, efêmera e limitada a
  180 nós exibidos. Nenhuma biblioteca de física/visualização foi adicionada;
  uma dependência só será considerada após medição e revisão de licença.

## Consequências

O grafo continua reconstruível e coerente com o vault. Em vaults grandes a UI
informa o limite de nós exibidos, e o usuário reduz o universo com filtros ou
grafo local antes de exigir uma visualização mais ampla.
