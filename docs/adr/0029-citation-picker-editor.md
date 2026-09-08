# ADR 0029 — F11/F12: picker e editor de citações

**Status:** aceito · 2026-09-08

## Decisão

`citation.openPicker` abre o picker avançado por `Mod+Shift+C`; ele consulta o
catálogo de referências já resolvido para a sessão e oferece modo parentético,
narrativo ou supressão de autor, além de locator, prefixo e sufixo. A ação final
é sempre `citation.insert`, um command que despacha uma `EditorTransaction` no
controller — o modal e CodeMirror não escrevem no vault.

Clicar numa citação encaminha apenas o offset para o host React. O host detecta
o trecho autoral editável no snapshot da sessão e abre o mesmo editor, que
substitui exatamente o range por uma transação. A fonte de verdade permanece o
Markdown; AST, validação e formatação ABNT continuam no parser/compiler.

Para tornar a forma narrativa com página inequívoca, a gramática aceita
`@chave [p. 42]`. A forma parentética também separa locator de sufixo:
`[@chave, p. 42, grifo nosso]`.

## Consequências

- Não há estado bibliográfico oculto no renderer ou SQLite.
- O editor visual não formata citações conforme ABNT; ele só serializa a
  linguagem de autoria já reconhecida pelo parser.
- A edição é atômica, revisionada pela sessão e entra no undo editorial normal.

## Fora de escopo

Citações múltiplas visuais, sugestão automática de locator, importação DOI e
edição da fonte bibliográfica. Esses temas pertencem às features de referências
posteriores, não ao editor de uma ocorrência.
