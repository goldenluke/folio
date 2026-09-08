# ADR 0010 — Sessões revisionadas acima de workspace e compiler

**Status:** aceito · 2026-09-07

## Contexto

O editor não pode usar a revisão persistida do arquivo como a única versão do
documento: uma pessoa pode digitar diversas vezes antes de salvar. Ao mesmo
tempo, `prepare`, resolução de bibliografia/recursos e `compile` são assíncronos.
Uma resposta antiga não pode substituir diagnósticos ou preview de um rascunho
mais novo — inclusive quando um processo remoto ignora o cancelamento pedido.

Colocar essa coordenação no compiler violaria seu contrato headless e exigiria
que ele conhecesse filesystem, editor e estado mutável. Colocá-la no renderer
duplicaria a lógica para CLI de watch, editor desktop e futuro language service.

## Decisão

`@abnt/workspace-sessions` é uma camada de aplicação sem Node, Electron ou
React. Ela recebe três portas:

- `WorkspaceStorage` para abrir, salvar e observar a fonte da verdade;
- `CompilerService` do protocolo P1 para executar `prepare → compile`;
- `CompilationEnvironmentResolver`, fornecido pelo host, para transformar as
  dependências declaradas em bibliografia, recursos e configuração efetiva.

Uma sessão é identificada pelo `WorkspaceFileId`. Ela tem revisão própria: cada
edição local a incrementa; salvar apenas atualiza a revisão persistida no
`WorkspaceFile`. O serviço inicia uma compilação por revisão e associa a ela um
token e um `AbortController`. Qualquer edição ou nova compilação aborta a
anterior. Depois de cada await, o token e a revisão são conferidos; se a resposta
não for mais atual, ela é descartada sem mutar diagnóstico, dependência ou preview.

O serviço emite eventos explícitos de mudança, dependências, diagnósticos,
preview, descarte, falha e conflito externo. UI e language service consomem
essas projeções; não observam filesystem nem executam o compiler diretamente.

## Consequências

- `AbortSignal` reduz trabalho desperdiçado, e o guard de token impede estado
  obsoleto mesmo com implementações de transporte que não cooperam.
- O preview é sempre associado à revisão que o produziu; resultados antigos são
  observáveis como descarte, não como uma atualização silenciosa.
- Bibliografia, DOI, recursos e perfis institucionais continuam responsabilidade
  de um resolver de ambiente do host. A sessão não ganha conhecimento de ABNT.
- Editor, CLI `watch` e language service poderão reutilizar exatamente a mesma
  semântica de concorrência sem compartilhar estado mutável entre processos.
