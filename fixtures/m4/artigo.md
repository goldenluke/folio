---
title: "Perfis de publicação sobre um modelo semântico"
authors:
  - name: "Ana Pesquisadora"
    affiliation: "Universidade Federal do Exemplo"
abstract: >
  Este artigo demonstra que a estrutura semântica de um documento pode ser
  preservada enquanto diferentes políticas editoriais transformam a mesma
  fonte em publicações distintas. O experimento combina seções, citações,
  figura, tabela, código e referências para verificar a passagem entre
  Markdown, Document AST, resolução semântica, Publication AST e PDF. A
  proposta mantém os dados de autoria e as relações bibliográficas fora do
  layout, permitindo que instituições e periódicos escolham apresentação sem
  reescrever o conteúdo. Também verifica que o profile acadêmico aplica
  elementos pré e pós-textuais de maneira previsível, rastreável e adequada
  para revisão visual automatizada. Assim, o mesmo artigo permanece portátil,
  auditável e preparado para novas normas e novos canais de publicação.
keywords:
  - arquitetura de software
  - publicação acadêmica
  - interoperabilidade
lang: pt-BR
bibliography: referencias.bib
---

# Introdução

O modelo semântico separa significado de apresentação, como discute @silva2024.

# Resultados

![Fluxo entre autoria, semântica e publicação](../completo/figuras/arquitetura.svg)

Fonte: [@silva2024]

Tabela: Camadas da publicação

| Camada | Responsabilidade |
| --- | --- |
| Documento | Conteúdo e relações |
| Profile | Apresentação editorial |

Fonte: [@silva2024]

Código: Compilação orientada por profile

```ts
const publication = compile(resolved, profile);
```

# Conclusão

O mesmo conteúdo pode gerar artigos visualmente distintos sem alterar a AST.
