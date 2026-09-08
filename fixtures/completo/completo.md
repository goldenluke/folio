---
title: "Consistência Eventual em Sistemas Replicados"
authors:
  - name: "Ana Ribeiro"
    affiliation: "Universidade Federal do Exemplo"
  - name: "Carlos Menezes"
    affiliation: "Instituto de Computação"

abstract: >
  Este artigo examina os compromissos entre consistência e disponibilidade em
  sistemas replicados geograficamente, e propõe um critério de decisão baseado
  na granularidade da fronteira transacional.

keywords:
  - consistência eventual
  - replicação
  - sistemas distribuídos

lang: pt-BR
---

# Introdução

Sistemas replicados enfrentam um compromisso bem conhecido entre consistência
e disponibilidade [@brewer2000]. A formulação original tratava a escolha como
binária; trabalhos posteriores mostraram que ela é feita *por operação*, e não
por sistema [@abadi2012, p. 37].

Segundo @vogels2009, a consistência eventual é suficiente para uma classe ampla
de aplicações, desde que a janela de inconsistência seja **limitada e
observável**[^janela].

[^janela]: A janela depende da latência de propagação e da taxa de conflito,
    e não é uma constante do sistema.

## Terminologia

Os termos usados ao longo do texto seguem as definições abaixo:

- **Consistência forte** — toda leitura observa a escrita mais recente.
- **Consistência eventual** — na ausência de novas escritas, as réplicas
  convergem.
- **Consistência causal** — operações causalmente relacionadas são observadas
  na mesma ordem por todas as réplicas.

A relação entre elas é de ~~equivalência~~ ordenação estrita: forte implica
causal, que implica eventual.

# Arquitetura

![Fluxo de propagação entre cliente, coordenador e réplicas](figuras/arquitetura.svg)

O coordenador recebe a escrita, confirma ao cliente e propaga em segundo plano.
A latência percebida é a do primeiro salto, e não a da convergência total.

## Modelo formal

A janela de inconsistência esperada é dada por:

$$
E[W] = \frac{\lambda_{p}}{\mu_{c}} \cdot \left(1 - e^{-\mu_{c} t}\right)
$$

onde $\lambda_{p}$ é a taxa de propagação e $\mu_{c}$ a taxa de convergência.

## Resultados observados

| Configuração | Latência p50 | Latência p99 | Janela média |
| ------------ | -----------: | -----------: | -----------: |
| Forte        |        142 ms |       890 ms |         0 ms |
| Causal       |         38 ms |       210 ms |        95 ms |
| Eventual     |         11 ms |        47 ms |       410 ms |

A diferença entre p50 e p99 é o que determina a experiência real do usuário —
a média isolada esconde o comportamento da cauda.

# Discussão

> A escolha entre consistência e disponibilidade não é uma decisão de
> arquitetura tomada uma vez, mas uma propriedade que cada operação negocia
> individualmente com o sistema.

O trecho acima resume o deslocamento conceitual da última década. Ver também a
formulação de @abadi2012 sobre latência como dimensão independente.

## Implementação de referência

O pseudocódigo do coordenador, simplificado:

```python
def escrever(chave, valor, nivel):
    versao = relogio.proximo()
    local.aplicar(chave, valor, versao)
    if nivel == "forte":
        aguardar(quorum_de_escrita())
    propagar_async(chave, valor, versao)
    return versao
```

A chamada `propagar_async` é o ponto em que a janela de inconsistência começa.
Detalhes de implementação estão disponíveis no [repositório do projeto](https://example.edu.br/repo).

---

# Conclusão

A fronteira transacional determina o custo de mudar de nível de consistência
depois. Sistemas que a definiram de forma estreita conseguiram migrar operação
por operação; os que a definiram no nível do serviço inteiro precisaram
reescrever a camada de persistência[^migracao].

[^migracao]: Dois dos três sistemas observados abandonaram a migração após
    estimar o custo.
