# ADR 0017 — Reference manager: resolver o alicerce que faltava

**Status:** aceito · 2026-09-07

## Contexto

O modelo bibliográfico (CSL-JSON, importador BibTeX, motor de formatação ABNT
próprio) está pronto desde o M2. O que não existia era o desktop RESOLVENDO
bibliografia nenhuma: `DesktopWorkspaceServiceHost.open()` usava
`criarResolvedorDeAmbienteVazio()` — cujo próprio comentário já dizia
"resolver útil para preview puramente local **antes de** integrar
bibliografia/recursos". Sem isso, toda citação em qualquer documento editado
no desktop resolvia contra um ambiente vazio; um painel de referências não
teria o que mostrar. A maior parte deste ciclo foi fechar esse alicerce, não
construir a UI em cima dele.

## Decisão

### Resolver de ambiente local do desktop, mesmo papel do `apps/cli/src/environment.ts`

`apps/desktop/src/workspace/environment.ts` implementa
`CompilationEnvironmentResolver` resolvendo `.bib` declarados em
`bibliography:` no frontmatter, mas via `WorkspaceStorage` — nunca `node:fs`
diretamente, como o resto do host. É a mesma composição que o CLI já prova há
muito tempo (compilador + `@abnt/bibliography` no mesmo processo, sem cruzar
fronteira de protocolo para isso); o desktop só troca "ler do disco" por "ler
do storage abstrato do vault".

A resolução de caminho relativo (`.bib` declarado como `referencias.bib`,
resolvido contra o diretório do documento) reaproveita `documentTarget`,
exportado de `@abnt/language-service` — a MESMA função que `definition`/
`references` já usam para resolver `[texto](destino.md)`. Um link e uma
dependência bibliográfica são, estruturalmente, o mesmo problema: URI relativa
autoral resolvida contra o vault. Reimplementar isso no desktop teria criado
uma segunda versão que diverge no primeiro caso de borda.

### Fronteira revisada: `bibliography` sai da lista proibida do host

A regra `workspace-desktop-nao-reimplementa-compilacao` (ADR 0015) proibia
`bibliography` no host do workspace desktop, por analogia apressada com
`compiler`/`markdown`/`standards`/`semantics`. Na prática, importar
`importarBibtex` para resolver uma dependência autoral é exatamente o mesmo
tipo de trabalho de host que resolver um recurso de imagem já era — não é
"reimplementar compilação", é o host adaptando arquivo bruto em
`CompilationEnvironment`, que é o motivo de essa camada existir. `compiler`/
`markdown`/`standards`/`semantics` continuam proibidos: esses SIM seriam
bypassar o Compiler Service isolado.

### Bibliografia resolvida precisa sobreviver à compilação — e não ser invalidada a cada tecla

`environment.resolve(...)` já rodava a cada auto-compile, mas o resultado
nunca era guardado: só `session.preview` (Publication AST) sobrevivia depois
do `compile()`. Sem um lugar para persistir, o painel de referências não
teria de onde ler. `DocumentSessionSnapshot`/`EditorSnapshot` ganharam um
campo `bibliography`, espelhando exatamente como `preview` já é propagado
sessão → controller → DTO.

Diferença deliberada de `preview`: `bibliography` **não** é zerado em
`replaceContent`. `preview` precisa desaparecer a cada edição porque mostrar
HTML desatualizado como se fosse atual é o erro que o ADR 0015 existe para
evitar. Referências bibliográficas raramente mudam por edição de prosa —
apagar o painel a cada tecla digitada seria pior UX que mostrar um catálogo
com alguns instantes de atraso, e nada consome `bibliography` como "estado
atual garantido" da forma que o preview precisa ser.

### `workspace/references` é projeção de produto, não o `BibliographyEnvironmentDto` cru

O DTO interno (`entries`/`sources`/`provenanceByReference`, indexados por id)
é a forma que a compilação precisa, não a forma que uma lista de UI precisa.
`WorkspaceReferenceDto` achata isso: `formatted` já vem pronto do MESMO motor
ABNT que o compilador usa (`formatarReferenciaAbnt` + `referenciaComoTexto`
de `@abnt/bibliography`, chamado no host, nunca reimplementado na UI — o
renderer não pode importar `bibliography` de qualquer forma, pela fronteira
já existente), e `sourceFileId` é resolvido no host para permitir "abrir
fonte" sem a UI precisar repetir a busca por caminho.

### Inserir citação é uma transação, não uma edição de string

`citation.insert` (comando, não função direta chamada pelo painel) lê a
seleção atual do editor ativo, calcula `min(anchor,head)`/`max(anchor,head)` e
despacha uma `EditorTransaction` com o texto `[@id]`, deixando o cursor logo
depois do texto inserido. O painel de Referências nunca toca CodeMirror nem
o controller diretamente — só chama o comando, como qualquer outra ação do
Command Registry (P9).

## Consequências

- Dois testes de integração sobre `MessagePort` real
  (`tests/p12-references.test.ts`): um documento com `.bib` real resolve e
  formata corretamente (prova a cadeia completa: frontmatter → resolver →
  BibTeX → CSL-JSON → ABNT), e um documento sem `bibliography:` no
  frontmatter não resolve nada — não é erro, é ausência legítima.
- Verificado manualmente no browser: painel lista as referências formatadas
  com proveniência, "Inserir citação" produz `[@id]` real no editor com o
  indicador de "sujo" aparecendo, "Abrir fonte" abre o `.bib` como uma tab
  comum mostrando o BibTeX bruto.
- `pnpm check` permanece verde; nenhuma fronteira nova precisou de exceção
  além da revisão já descrita.

## Não decidido aqui

Qual fonte bibliográfica é **editável** (criar/mutar entradas — inline,
`.bib`, CSL-JSON gerenciado, Zotero) fica deliberadamente em aberto; este
ciclo entrega um reference manager de leitura. Adapters DOI/RIS/Zotero/
Crossref também ficam para depois — quando existirem, precisam normalizar
para o mesmo modelo CSL-JSON, nunca deixar o JSON do provedor atravessar o
domínio. Resolução de recursos (imagens) no ambiente do desktop continua sem
resolver, mesma lacuna já registrada no preview do P10.
