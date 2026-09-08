---
title: "Arquitetura de Software para Sistemas Distribuídos"
authors:
  - name: "João da Silva"
    affiliation: "Universidade Federal do Exemplo"
    email: "joao@example.edu.br"
  - name: "Maria Souza"
    affiliation: "Universidade Federal do Exemplo"

abstract: >
  Este artigo apresenta uma análise de decisões arquiteturais recorrentes em
  sistemas distribuídos, com atenção a consistência, particionamento e
  tolerância a falhas. Discute-se o impacto dessas decisões sobre a
  manutenibilidade de sistemas de larga escala, a partir de casos observados
  na literatura e na prática industrial.

keywords:
  - arquitetura de software
  - sistemas distribuídos
  - escalabilidade

lang: pt-BR
---

# Introdução

Sistemas distribuídos apresentam desafios que não existem em sistemas de nó
único. A necessidade de coordenar estado entre máquinas introduz modos de
falha parciais, nos quais parte do sistema permanece disponível enquanto outra
parte se torna inacessível.

Este trabalho examina como decisões tomadas no início do projeto arquitetural
restringem o espaço de soluções disponível mais adiante, frequentemente de
maneira irreversível.

## Motivação

A literatura de arquitetura frequentemente trata consistência e disponibilidade
como um par de opções entre as quais se escolhe uma. Na prática, a escolha é
feita por operação, e não por sistema.

## Objetivos

Delimitar critérios objetivos para essa escolha, e demonstrar que **a decisão
arquitetural mais cara de reverter** é a que define a fronteira transacional.

# Metodologia

A análise combina revisão da literatura com estudo de três sistemas em
produção, observados ao longo de dezoito meses.

## Coleta de dados

Foram coletadas métricas de latência, taxa de erro e tempo de recuperação após
incidente, agregadas por semana.

## Limitações

O recorte industrial restringe a generalização dos resultados: os três sistemas
observados pertencem ao mesmo domínio de aplicação.

# Resultados

Os sistemas que definiram fronteiras transacionais estreitas apresentaram tempo
de recuperação significativamente menor, ao custo de maior complexidade no
código de aplicação.

# Conclusão

A fronteira transacional é o compromisso arquitetural determinante. Movê-la
depois exige reescrever a camada de persistência e a lógica de aplicação
simultaneamente, o que raramente é viável em sistemas em produção.
