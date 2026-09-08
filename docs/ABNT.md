# Escopo normativo

## Direito autoral — leia antes de escrever regra

As normas ABNT são vendidas pela própria ABNT e **o texto delas é protegido por
direito autoral**. Regras não são protegíveis; a redação delas é.

Portanto, neste repositório:

- codifique a **regra**, cite a cláusula **por número**;
- **nunca** copie o texto normativo para código, comentário, teste ou mensagem
  de diagnóstico;
- mensagens de diagnóstico devem ser paráfrase própria.

Errado:

```ts
message: '<trecho literal copiado da norma>'
```

Certo:

```ts
message: 'Citação direta sem indicação de página. NBR 10520:2023, seção 6.1.'
```

Isto vale igualmente para material derivado — apostilas de universidade que
reproduzem a norma carregam o mesmo problema.

## Normas em jogo

| Norma | Assunto | Status |
|---|---|---|
| NBR 6022:2018 | artigo em publicação periódica | profile de artigo (M4) |
| NBR 6023:2018 | referências | seis tipos centrais (M2) |
| NBR 6024:2012 | numeração progressiva | implementado (M0) |
| NBR 6028:2021 | resumo | artigo e TCC, com validação de extensão |
| NBR 10520:2023 | citações | autor-data e numérico (M2) |
| NBR 14724:2011 | trabalhos acadêmicos (TCC, dissertação, tese) | profile de TCC (M5) |

"ABNT" não é uma regra única, e o **ano faz parte da identidade**: um documento
escrito sob a NBR 10520:2002 não deve mudar de forma ao ser recompilado depois
que a 2023 sai. Por isso os módulos de norma são versionados
(`abnt:nbr-10520@2023`) e o profile declara quais versões usa.

## Norma ≠ profile institucional

Distinção que precisa continuar valendo:

- **Norma** define o requisito normativo (NBR 6023 diz o que uma referência
  contém e em que ordem).
- **Profile** define a política editorial concreta (a Universidade X exige
  fonte Arial, margem tal, e uma folha de aprovação com este layout).

Universidades e periódicos rotineiramente acrescentam e reinterpretam. Um
profile `extends` uma ou mais normas e acrescenta o que é dele. Sem essa
separação, cada universidade viraria um fork da implementação da norma.

## O que o M0 realmente faz

Honestidade de escopo, porque a saída *parece* mais completa do que é:

**Implementado:** página A4, margens 3/2/2/3 cm, corpo 12 com entrelinhas 1,5,
recuo de primeira linha 1,25 cm, numeração progressiva, título de seção por
nível, elementos pré-textuais (título, autores, resumo, palavras-chave),
numeração de página no canto superior direito.

**Não implementado:** citações, referências, notas de rodapé, figuras e tabelas
com legenda e fonte, sumário, e **toda a validação normativa**. `folio lint` hoje
não tem catálogo de regras — ele avisa isso na saída, de propósito, para
ninguém concluir que o documento passou numa verificação ABNT.

## O que o M1 acrescenta

**Modelo e parsing:** ênfase, strike, links, código e matemática inline/bloco,
listas GFM, citações, referências cruzadas, figuras, tabelas, notas e
containers. Recursos, notas e referências ficam em registries; todos os nós
relevantes preservam source range. A AST v1 tem validação Zod e JSON Schema
versionado.

**Publicação já verificável:** figuras SVG com legenda, tabelas, citação em
bloco com token visual de citação longa, código e notas no rodapé da página em
que são chamadas. Esses recursos provam as costuras do modelo e do renderer;
**não provam conformidade normativa**.

**Ainda não implementado:** classificação normativa automática de citação
longa, sumário e profile NBR 6022 completo.

## O que o M2 acrescenta

**Bibliografia:** BibTeX é convertido para um registry compatível com
CSL-JSON. O profile gera livro, capítulo, artigo de periódico, trabalho em
evento, tese/dissertação e documento eletrônico segundo a NBR 6023:2018.

**Citações:** chamadas autor-data e numéricas da NBR 10520:2023, localização,
múltiplas fontes, autoria narrativa, desambiguação de mesmo autor/ano e ordem
numérica por primeira ocorrência. Chave ausente é erro com source range; o
sistema numérico combinado com notas também é diagnosticado.

## O que o M3 acrescenta

**Semântica:** a resolução virou uma cadeia explícita de passes, incluindo
índice de identificadores, numeração e referências cruzadas. O alvo e o texto
de cada referência cruzada são anotações derivadas; nenhum número ou rótulo é
gravado na AST.

**Validação:** `folio lint` reúne diagnósticos semânticos e um catálogo inicial
versionado: localização de citação direta, chave bibliográfica ausente,
referência não citada, legenda e fonte de figura, além do tamanho de resumo
configurado pelo profile de artigo. As mensagens são paráfrases próprias e
identificam a norma/ano pertinente, sem reproduzir redação normativa.

## O que o M4 acrescenta

**Artigo:** o profile de artigo publica o fluxo completo de título, autoria,
resumo, palavras-chave, seções, citações, figuras, tabelas, código e
referências. No Markdown, `Fonte: ...` logo após figura ou tabela torna-se a
atribuição do elemento; `Tabela: ...`, `Código: ...`, `Figura: ...` e
`Equação: ...` imediatamente antes de um elemento fornecem a legenda. Essas
convenções descrevem estrutura, não formatação.

**Abstração e fidelidade:** `web-article` recompila a mesma AST sem números de
seção, em papel Letter e com outro tema, sem aplicar regras ABNT. O gate
`pnpm test:visual` gera PDF, renderiza cada página em PNG e compara com os
baselines aprovados em `tests/visual-baselines/`.

## O que o M5 acrescenta

**Trabalho acadêmico:** o profile `abnt-tcc` compõe capa, folha de rosto,
ficha catalográfica, folha de aprovação, dedicatória, agradecimentos,
epígrafe, resumo, abstract, listas, sumário, corpo e referências. Elementos
opcionais só são emitidos quando seus metadados existem.

O frontmatter continua genérico. Autoria e banca usam `contributors` com
papéis `author`, `advisor`, `coadvisor` e `reviewer`; campos editoriais ficam
em `properties` com namespace `tcc:*`, por exemplo `tcc:institution`,
`tcc:nature`, `tcc:place`, `tcc:year`, `tcc:approval-date` e
`tcc:catalog-card`. Essa convenção não acrescenta nenhum nó de TCC ao
`document-model`.

**Conteúdo gerado:** listas de ilustrações, tabelas e códigos são derivadas dos
elementos numerados. O sumário deriva das seções e das anotações semânticas;
os números de página são resolvidos por `target-counter()` no backend
paginado. A numeração e os textos gerados permanecem na Publication AST.

**Validação:** o catálogo do TCC verifica metadados estruturais, resumos nos
dois idiomas, palavras-chave, legendas e indicação de fonte. É um recorte
automatizado e versionado das normas usadas pelo profile, não uma declaração
de conformidade jurídica ou editorial de uma instituição específica.

## Prior art

Vale conhecer antes de reimplementar:

- **[abntyp](https://typst.app/universe/package/abntyp/)** — pacote Typst para
  documentos ABNT, com autor-data e numérico da NBR 10520:2023. É o plano B do
  [ADR 0003](adr/0003-backend-pdf.md) e uma referência útil de como as regras se
  traduzem em layout.
- **[abntex2](https://ctan.org/pkg/abntex2)** — a implementação LaTeX de
  referência, madura e muito completa. Boa fonte para entender casos de borda.
- **[csl-abnt](https://github.com/virgilinojuca/csl-abnt)** e os estilos ABNT no
  [repositório CSL](https://github.com/citation-style-language/styles) —
  **oráculo de teste** para o M2, não dependência de runtime. Ver
  [ADR 0002](adr/0002-motor-de-citacao-proprio.md).
