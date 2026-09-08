# ADR 0006 — Autoria e ambiente formam uma Compilation Unit

**Status:** aceito · 2026-09-07

## Contexto

O Markdown declara dependências — bibliografia e recursos — mas não contém os
bytes do disco, a localização do vault, credenciais remotas ou a política de
embedding. Antes desta decisão, o CLI carregava BibTeX e resolvia recursos,
clonando o resultado para dentro da `DocumentAst`. Isso confundia autoria com
estado externo e impossibilitava o mesmo documento ser compilado em ambientes
distintos sem reescrever a árvore.

## Decisão

O modelo autoral permanece:

```text
Document AST = o que o autor declarou
```

O host prepara dados externos e serializáveis:

```text
Compilation Environment = bibliografia efetiva + recursos resolvidos + proveniência
```

O compiler trabalha na unidade:

```text
Compilation Unit = Document AST + Compilation Environment
```

O API é assíncrono e possui duas fases. `prepare(SourceSnapshot)` faz parse e
declara dependências. O host resolve essas dependências e fornece um
`EnvironmentPreparation`; então `compile()` produz `ResolvedDocument`, relatório
de validação e `Publication AST`. O compiler não faz I/O, não gera HTML e não
inicia processos.

Entradas bibliográficas autorais têm precedência sobre entradas do ambiente.
Toda colisão produz diagnóstico; não há sobrescrita silenciosa. Recursos
resolvidos são uma projeção efêmera para `publication`; `ast.resources` mantém
a URI autoral.

## Consequências

- CLI, desktop e language service reutilizam o mesmo pipeline.
- O `ResolvedDocument` recebe `bibliography` efetiva sem alterar sua AST.
- `SourceSnapshot` leva revisão e hash do host para invalidação futura.
- A API verifica `AbortSignal` entre fases. Cancelamento preemptivo exige
  worker e fica para a fase de serviços.
- `PreparedCompilation` e `CompilationEnvironment` são dados serializáveis.
  `CompilationResult` ainda contém `AnnotationStore` e `Map`s para uso local;
  seu DTO de transporte e reidratação pertencem à P1/protocolo.
- A política de sandbox de caminhos permanece responsabilidade do host. A P0
  preserva caminhos relativos existentes; um workspace futuro pode produzir
  `ResourceResolution.status = blocked` sob política explícita.
