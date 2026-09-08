# Arquitetura

## As três perguntas

O sistema inteiro se organiza em torno de três perguntas distintas, e a maior
parte dos erros de design vem de responder duas delas na mesma camada.

| Camada | Pergunta | Package |
|---|---|---|
| Sintaxe | O que foi escrito? | `markdown` |
| Modelo semântico | O que isso significa? | `document-model`, `semantics` |
| Publicação | Como isso deve aparecer? | `publication`, `standards`, `renderer-*` |

A ABNT atua **entre as duas últimas**. Ela não é parte da arquitetura
fundamental; é um consumidor do modelo genérico.

```
significado  +  norma  →  apresentação
```

## O pipeline

```
                         SourceSnapshot
                               │
                  ┌────────────▼────────────┐
                  │ @abnt/compiler.prepare  │
                  └───────┬───────────┬──────┘
                          │           │ dependências declaradas
                    ┌─────▼──────┐    ▼
                    │ @abnt/markdown │   mdast → nós semânticos
                    └───────┬────────┘   offsets corrigidos p/ frontmatter
                            │
                  ┌─────────▼──────────┐
                  │   Document AST     │  imutável, sem norma, sem layout
                  │ @abnt/document-model│  IDs determinísticos, SourceRange
                  └─────────┬──────────┘
                            │
          Compilation Environment  ← host (CLI/Desktop/LSP)
                            │
                  ┌─────────▼──────────┐
                  │ @abnt/compiler.compile │
                  └─────────┬──────────┘
                            │
                  ┌─────────▼──────────┐
                  │  @abnt/semantics   │  passes: normalização, numeração de
                  │                    │  normalização, numeração, citações,
                  │                    │  identificadores e cross-references
                  │  ResolvedDocument  │  = AST + bibliografia efetiva + anotações + diagnósticos
                  └─────────┬──────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                                       │
┌───────▼────────┐                   ┌──────────▼─────────┐
│ @abnt/standards│                   │ @abnt/publication  │
│                │                   │                    │
│ validação →    │  implementa       │ define             │
│ Diagnostic[]   │  PublicationProfile│ PublicationProfile │
│                ├──────────────────►│                    │
│ perfilArtigoAbnt│                  │ compilarPublicacao │
└────────────────┘                   └──────────┬─────────┘
                                                │
                                     ┌──────────▼─────────┐
                                     │  Publication AST   │  numeração resolvida
                                     │                    │  tokens de estilo
                                     └──────────┬─────────┘
                                                │
                                     ┌──────────▼─────────┐
                                     │@abnt/renderer-html │  burro de propósito
                                     └──────────┬─────────┘
                                                │
                                    HTML ───────┴─────── PDF
                                  (preview)         (Paged.js + Chromium)
```

Note a inversão no meio: `publication` **define** a interface `PublicationProfile`
e `standards` a **implementa**. É isso que mantém o compilador sem conhecimento
de norma e permite mais de um profile ao mesmo tempo.

## Packages

| Package | Responsabilidade | Pode importar |
|---|---|---|
| `document-model` | AST, IDs, SourceRange, Diagnostic, schemas, registries | **nada do workspace**; Zod em runtime |
| `markdown` | sintaxe → AST | `document-model` |
| `bibliography` | importador BibTeX, utilitários CSL-JSON e referências | `document-model` |
| `semantics` | passes, anotações, diagnósticos | `document-model`, `bibliography` |
| `standards` | normas: validação + profiles + motores de citação | `document-model`, `bibliography`, `semantics`, `publication` |
| `publication` | ResolvedDocument + profile → Publication AST | `document-model`, `semantics` |
| `renderer-html` | Publication AST → HTML | **só** `publication` |
| `compiler` | autoria + ambiente → resolução, validação e Publication AST | domínio; sem I/O/render/UI |
| `protocol` | DTOs, erros e transporte versionado entre serviços | `document-model`, `publication`; sem implementações |
| `workspace-core` | vault, identidade, revisões, eventos e contrato de storage | **nada do workspace** |
| `workspace-local` | adaptador Node: filesystem, watcher, journals e config | `workspace-core` + Node |
| `workspace-index` | projeção SQLite/FTS5 reconstruível do vault | `workspace-core`, `markdown`, `document-model` + Node |
| `workspace-sessions` | rascunhos revisionados, cancelamento e eventos de compilação | `workspace-core`, `protocol` |
| `language-service` | outline, diagnósticos, autocomplete e navegação do documento | parser, sessões, índice e storage abstrato |
| `editor-core` | transações, seleção e controllers de documentos abertos | `workspace-sessions`, `language-service` |
| `editor-codemirror` | adaptador visual de `EditorController` para CodeMirror 6 | `editor-core`, `language-service`, CodeMirror |
| `apps/cli` | host local: filesystem, ambiente, comandos, HTML e PDF | compiler + pontas |

Ausentes de propósito: shell desktop, `plugin-api`, `sync`, `renderer-docx` e
LSP. A arquitetura de destino tem ~40 packages e vários processos; começamos
com 8 porque **fronteira de package é barata de adicionar e cara de manter
vazia**. Cada fronteira que existe hoje codifica um invariante que o CI fiscaliza
— nenhuma existe só para descrever um conceito.

As regras estão em [`.dependency-cruiser.cjs`](../.dependency-cruiser.cjs) e
rodam em `pnpm check:boundaries`. Foram testadas com uma violação deliberada.

## Os quatro modelos

### 1. Syntax tree (mdast)
O que o autor escreveu. Interno ao `markdown`; não escapa do package.

### 2. Document AST
Significado. Imutável, serializável, versionada (`schema` + `version`).

Não contém: número de seção, citação formatada, tamanho de fonte, margem,
nome de norma. Contém: estrutura, papéis semânticos, metadados, SourceRange.

### 3. ResolvedDocument
Document AST + `AnnotationStore` + `Diagnostic[]`.

Anotações são o que o compilador **concluiu**; atributos são o que o autor
**declarou**. A separação permite que a mesma AST tenha duas resoluções
(uma por norma) compartilhando uma única árvore.

### 4. Publication AST
Apresentação lógica. Aqui já existe número de seção resolvido e token de
estilo — mas **não** valor bruto de layout. `quote-long` é o token; que ele
significa recuo de 4 cm e corpo 10 é decisão do tema, no profile.

## Por que os números não moram na AST

É a decisão mais consequente do modelo, e a mais fácil de "otimizar" por engano.

Se `SectionNode` tivesse `number: "2.1"`:

- inserir uma seção acima obrigaria a reescrever a subárvore inteira;
- a mesma AST não poderia ser publicada sob duas normas com regras de
  numeração diferentes;
- cache por hash de conteúdo quebraria (o hash mudaria por causa de dado
  derivado, não por edição real);
- edição incremental no editor invalidaria muito mais do que o necessário.

Há um teste que falha se alguém gravar número na AST
(`tests/golden.test.ts`, bloco "invariantes do modelo").

## Estado do M1

O Document AST v1 possui nós para texto rico, citações, referências cruzadas,
notas, figuras, tabelas, código, matemática, listas e containers. Notas,
recursos e referências vivem em registries; números calculados continuam no
`AnnotationStore`. O formato serializado é validado por Zod e publicado como
`packages/document-model/schema/v1.schema.json`.

`Diagnostic` mora em `document-model`, não em `semantics`: parsing, resolução,
normas e publicação podem diagnosticar sem importar uma camada acima. Isso
permitiu transformar YAML inválido em aviso recuperável com source range.

O primeiro passe semântico é `normalizarDocumento`: ele converge formas
equivalentes numa representação canônica, é idempotente e preserva referências
quando nada muda. Essa última propriedade prepara cache e compilação
incremental sem gravar resultado derivado na AST de autoria.

## Estado do M2

O registry bibliográfico usa propriedades e nomes do schema CSL-JSON. O
importador `@retorquere/bibtex-parser` (ISC) fica encapsulado em
`@abnt/bibliography`: tipos, campos e markup próprios de BibTeX não atravessam
essa fronteira. `bibliography:` no frontmatter é declarado pela AST, mas
resolvido pelo host no `CompilationEnvironment`. A bibliografia efetiva vive
em `ResolvedDocument.bibliography`; a AST não é hidratada com dados do disco.

`ResolvedDocument.citations` guarda somente resultados derivados: ordem de
primeira ocorrência para o sistema numérico, referências citadas e sufixos de
desambiguação de ano. Os profiles ABNT transformam esses dados em chamadas
autor-data ou numéricas e geram a seção de referências no Publication AST.
Livro, capítulo, artigo de periódico, trabalho em evento, tese/dissertação e
documento eletrônico possuem goldens em `tests/oracles/`.

## Estado do M3

`semantics` expõe `SemanticPass<I, O>` e a cadeia padrão de resolução. Cada
passe pode ser executado isoladamente; a cadeia produz `ResolvedDocument` sem
mutar a AST. Cross-references recebem alvo e texto lógico em `AnnotationStore`,
e `publication` apenas consome esse texto.

`standards` concentra `RegraDeValidacao` e `RelatorioDeValidacao`. O CLI reúne
diagnósticos de parsing, bibliografia, recursos, semântica e as regras ABNT;
isso mantém o `lint` útil sem obrigar renderers a saberem de normas.

## Estado do M4

O profile `abnt:artigo@6022-2018` cobre o artigo usado como fixture de ponta a
ponta. O profile independente `web:article@1` usa exatamente a mesma Document
AST, mas escolhe papel Letter, outro tema, títulos sem numeração, referências
genéricas e legendas abaixo dos elementos. A única adição compartilhada foi a
opção de publicação `mostrarNumerosDeSecao`; `document-model` não mudou.

`scripts/visual-regression.mjs` recompila os dois profiles, converte os PDFs
com Poppler e compara os PNGs com os baselines aprovados. Ele roda em
`pnpm check`, junto dos testes de semântica e das fronteiras de dependência.

## Estado do M5

O profile `abnt:tcc@14724-2011` usa propriedades namespaced e papéis genéricos
de contribuidores para gerar os elementos próprios de um trabalho acadêmico.
Nenhum tipo, campo ou role específico de TCC foi acrescentado ao
`document-model`.

A Publication AST ganhou âncoras em elementos publicáveis, um bloco genérico
de sumário/lista navegável e políticas de página nomeada. Isso permite que o
profile gere listas e sumário com `target-counter()` sem o renderer conhecer
ABNT ou TCC. Páginas pré-textuais usam uma variante sem número visível; o
corpo usa a página padrão numerada. A fixture M5 cobre 17 páginas em regressão
visual, além dos dois baselines do M4.

## Próximas camadas (ainda não construídas)

`protocol` já existe como contrato validado para execução in-process ou por
`MessagePort`; ele serializa a saída do compiler sem ensinar o domínio sobre
IPC. `workspace-sessions` é a primeira camada de aplicação: guarda o rascunho
em memória, atribui uma revisão a cada edição e cancela/descarta resultados de
compilação que não pertençam mais à revisão atual. A sessão chama o compiler
somente pelo contrato P1 e recebe uma porta para materializar o ambiente; assim
nem o compiler nem a sessão acessam filesystem diretamente. O workspace
local-first também já existe: filesystem é a fonte de verdade, enquanto
`.academic/workspace-state.json` preserva identidade e revisão. O índice
SQLite/FTS5 em `.academic/index.sqlite` é projeção descartável: headings, links,
citações, recursos e busca são reconstruídos a partir do vault.
`language-service` combina essas duas perspectivas: faz parse da fonte atual
da sessão para que autocomplete e outline enxerguem o rascunho, e consulta o
índice apenas para relações globais já persistidas. Ele não conhece CodeMirror
ou Electron. `editor-codemirror` é o adaptador visual já construído: transforma
transações e seleção de uma `EditorView` em chamadas ao `EditorController` e
projeta de volta snapshots, lint, autocomplete e hover. A fonte segue na sessão;
o estado CodeMirror é uma projeção descartável. O desenho de destino ainda inclui
shell desktop, language server, plugin host isolado e sync. A ordem prevista está no
[roadmap](ROADMAP.md). Nada disso deve alterar `document-model`; se alterar,
a abstração está errada e é melhor descobrir cedo. M4 provou isso com um
segundo profile deliberadamente diferente; M5 provou novamente com uma
estrutura documental muito mais extensa sem alterar o núcleo semântico.
