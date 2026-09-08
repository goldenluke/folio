import type { BlockNode, DocumentAst, SectionNode } from '@abnt/document-model';
import { isSection } from '@abnt/document-model';

import type { AnnotationStore } from '../annotations.js';

/** Anotação com o número resolvido da seção: "1", "2.1", "2.1.3". */
export const NUMERO_DA_SECAO = 'semantic:section-number' as const;

/** Nível da seção depois do aninhamento (1 = topo), independente do `depth` do heading. */
export const NIVEL_DA_SECAO = 'semantic:section-level' as const;

export interface OpcoesDeNumeracao {
  /**
   * Papéis que não entram na numeração progressiva.
   *
   * A NBR 6024 numera as seções do texto, mas elementos como resumo,
   * agradecimentos e a própria lista de referências são seções *sem* indicativo
   * numérico. Quem decide a lista é o profile da norma — este pass só recebe.
   */
  readonly semNumeracao?: ReadonlySet<string>;
}

/**
 * Calcula a numeração progressiva das seções e grava nas anotações.
 *
 * A AST não é tocada. Trocar a norma (ou reordenar uma seção) recalcula este
 * pass sem invalidar a árvore — que é o ponto de manter número fora do nó.
 */
export function numerarSecoes(
  ast: DocumentAst,
  anotacoes: AnnotationStore,
  opcoes: OpcoesDeNumeracao = {},
): void {
  const semNumeracao = opcoes.semNumeracao ?? new Set<string>();

  const visitar = (blocos: readonly BlockNode[], prefixo: readonly number[]): void => {
    let contador = 0;

    for (const bloco of blocos) {
      if (!isSection(bloco)) continue;

      const secao: SectionNode = bloco;
      const numerada = secao.role === undefined || !semNumeracao.has(secao.role);

      let proximoPrefixo = prefixo;
      if (numerada) {
        contador += 1;
        proximoPrefixo = [...prefixo, contador];
        anotacoes.set(secao.id, NUMERO_DA_SECAO, proximoPrefixo.join('.'));
      }

      anotacoes.set(secao.id, NIVEL_DA_SECAO, proximoPrefixo.length);
      visitar(secao.children, proximoPrefixo);
    }
  };

  visitar(ast.document.children, []);
}
