# ADR 0045 — leitor PDF interno e anotações locais

**Data:** 2026-09-08  
**Estado:** aceito

## Contexto

F35 já associa um PDF local a uma referência CSL-JSON, mas abrir o arquivo em
aplicativo externo quebra o fluxo de leitura, anotação e escrita.

## Decisão

O renderer usa PDF.js com worker emitido localmente pelo bundle para renderizar
páginas, miniaturas, zoom, busca e uma camada de texto selecionável. O
Workspace Service fornece os bytes do anexo como base64 por DTO validado; ele
nunca expõe path absoluto, `file://` nem acesso ao filesystem ao renderer.

Annotations são persistidas em `references/annotations.json`, separadas de
`references/library.json` e `references/attachments.json`. Cada annotation
guarda referência, página, trecho, comentário opcional, data e o id opcional da
literature note. Enviar para a nota cria/reusa `papers/{referenceId}.md` e
acrescenta um bloco Markdown marcado de modo idempotente.

## Consequências

- O ciclo local-first `Referência → PDF → highlight → annotation → note` fica
  disponível sem tornar a anotação parte do modelo bibliográfico canônico.
- PDF grande atravessa IPC como base64; streaming/range requests são uma futura
  otimização, não um motivo para vazar paths ao renderer.
- O destaque é uma projeção do trecho persistido sobre a camada de texto do
  PDF, portanto uma alteração no PDF pode impedir a localização visual, mas
  não apaga a annotation autoral.
