# ADR 0007 — Protocolo de serviços versionado e serializável

**Status:** aceito · 2026-09-07

## Contexto

O compiler já é headless, mas seu resultado local contém `Map`,
`AnnotationStore` e IDs branded. Isso é adequado dentro do domínio, mas não
atravessa com segurança um `MessagePort`, um worker, um utility process ou o
preload de uma aplicação desktop. Deixar cada host decidir a serialização
criaria APIs informais e divergentes antes mesmo de existir o desktop.

## Decisão

`@abnt/protocol` define DTOs serializáveis, `ProtocolResult<T>`, erros estáveis
e envelopes com `version`. O protocolo é independente de Node, Electron,
compiler e UI; ele pode conhecer somente os modelos canônicos necessários para
validar dados (`Document AST` e `Publication AST`).

O adaptador em `@abnt/compiler` converte entre domínio e DTO. Em particular:

- `AnnotationStore` vira registro JSON ordenado;
- `Map` vira `Record<string, ...>`;
- IDs branded tornam-se strings no limite e são restaurados somente pelo
  adaptador de domínio após validação;
- `Error`, stack trace e valores arbitrários não cruzam o processo.

Todo request e response passa por schema runtime. Uma versão diferente é
rejeitada como `UNSUPPORTED_VERSION`; não há tentativa de "interpretar o que
parece próximo". A versão do protocolo é deliberadamente distinta da versão da
Document AST: as duas evoluem e migram em ritmos diferentes.

`createInProcessCompilerClient` usa as mesmas validações do cliente
`MessagePort`. Assim, testar em memória não mascara um DTO que quebraria no
desktop. O teste de contrato P1 executa ambos contra o mesmo serviço e compara
os resultados.

O protocol também declara a superfície inicial de `WorkspaceService`, sem
implementá-la. Storage, identidade de arquivo, conflitos e eventos concretos
continuam pertencendo à P2.

## Consequências

- P7 pode transportar compiler entre renderer e utility process sem inventar
  canais IPC ad hoc.
- CLI, LSP e testes podem usar o mesmo contrato in-process.
- A fronteira é uma validação de segurança e compatibilidade, não apenas um
  conjunto de interfaces TypeScript.
- Toda adição incompatível exige incremento de versão e adaptador/migração
  explícitos, em vez de campos opcionais acumulados silenciosamente.
