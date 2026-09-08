import type {
  BibliographicEntity,
  BlockNode,
  CitationNode,
  InlineNode,
  Registry,
} from '@abnt/document-model';
import type { Diagnostic } from '@abnt/semantics';

import type {
  PagePolicy,
  PublicationBlock,
  PublicationInline,
  StyleToken,
  StyleTokenRegistry,
} from './model.js';
import type { ResolvedDocument } from '@abnt/semantics';

/** Tipo de elemento que recebe legenda numerada. */
export type TipoDeLegenda = 'figure' | 'table' | 'code' | 'equation';

export interface ContextoDeCitacao {
  readonly references: Registry<BibliographicEntity>;
  readonly numberByReference: ReadonlyMap<string, number>;
  readonly yearSuffixByReference: ReadonlyMap<string, string>;
}

export interface ResultadoDeCitacao {
  readonly conteudo: readonly PublicationInline[];
  readonly diagnosticos?: readonly Diagnostic[];
}

/**
 * Motor de citação.
 *
 * Esta é a costura preenchida no M2. Separá-la importa porque a
 * alternativa — o compilador montar `(Silva, 2024)` inline — espalharia regra
 * de norma pelo caminho de publicação, exatamente o que a arquitetura evita.
 *
 * Ver docs/adr/0002 para por que este motor é escrito por nós e não importado.
 */
export interface MotorDeCitacao {
  readonly id: string;
  formatar(citacao: CitationNode, ctx: ContextoDeCitacao): ResultadoDeCitacao;
  validarDocumento?(doc: ResolvedDocument): readonly Diagnostic[];
}

/**
 * Conversores que o compilador empresta ao profile.
 *
 * Sem isto, o profile teria que reimplementar a conversão para montar os
 * elementos pré-textuais — e a cópia não passaria pelo motor de citação, de
 * modo que uma citação dentro do resumo sairia formatada de um jeito no corpo
 * e de outro no resumo.
 */
export interface UtilitariosDoProfile {
  inline(nodes: readonly InlineNode[]): readonly PublicationInline[];
  blocos(nodes: readonly BlockNode[]): readonly PublicationBlock[];
}

/** Tokens de estilo por tipo de bloco. O profile nomeia; o tema define. */
export interface TokensDoProfile {
  readonly paragrafo: StyleToken;
  readonly citacaoEmBloco: StyleToken;
  readonly lista: StyleToken;
  readonly itemDeLista: StyleToken;
  readonly figura: StyleToken;
  readonly tabela: StyleToken;
  readonly codigo: StyleToken;
  readonly equacao: StyleToken;
  readonly separador: StyleToken;
  readonly legenda: StyleToken;
  readonly fonte: StyleToken;
  readonly nota: StyleToken;
  readonly referencia: StyleToken;
}

/**
 * Um profile de publicação decide como um documento resolvido vira publicação.
 *
 * É a costura onde uma norma se conecta ao compilador. `@abnt/standards`
 * implementa esta interface para ABNT; um profile "web-article" a implementa
 * de forma deliberadamente diferente.
 *
 * Esse segundo consumidor não é enfeite: uma abstração validada contra um único
 * consumidor é uma abstração que só parece genérica. Ver docs/adr/0001.
 */
export interface PublicationProfile {
  /** Identidade versionada: `abnt:artigo@6022-2018`. */
  readonly id: string;

  readonly page: PagePolicy;
  readonly styles: StyleTokenRegistry;
  readonly tokens: TokensDoProfile;

  /** Papéis de seção sem indicativo numérico (resumo, referências, ...). */
  readonly secoesSemNumeracao?: ReadonlySet<string>;

  /**
   * Decide se os indicativos semânticos calculados aparecem na publicação.
   * O perfil web usa a mesma AST e a mesma numeração derivada, mas escolhe
   * uma navegação visual sem números.
   */
  readonly mostrarNumerosDeSecao?: boolean;

  /** Elementos pré-textuais, na ordem em que aparecem. */
  frontMatter(doc: ResolvedDocument, utils: UtilitariosDoProfile): readonly PublicationBlock[];

  /** Elementos pós-textuais gerados, como a bibliografia. */
  backMatter?(doc: ResolvedDocument, utils: UtilitariosDoProfile): readonly PublicationBlock[];

  /** Token do título de seção para um dado nível (1 = seção primária). */
  estiloDeTitulo(nivel: number): StyleToken;

  readonly motorDeCitacao?: MotorDeCitacao;

  /**
   * Monta a legenda. A ABNT usa "Figura 1 — Texto" com travessão, acima do
   * elemento; outras normas usam "Fig. 1. Texto" abaixo. Daí ser do profile.
   */
  formatarLegenda?(
    tipo: TipoDeLegenda,
    numero: string | undefined,
    texto: readonly PublicationInline[],
  ): { readonly conteudo: readonly PublicationInline[]; readonly position: 'above' | 'below' };

  /** Marcador da nota de rodapé a partir do índice (1-based). */
  marcadorDeNota?(indice: number): string;
}

/**
 * Fallback provisório para qualquer profile que não registre motor próprio.
 *
 * Produz `(chave)` e um aviso — deliberadamente feio e deliberadamente
 * barulhento. A tentação seria devolver algo com cara de citação ABNT, e aí
 * ninguém perceberia que a norma ainda não está implementada.
 */
export const motorDeCitacaoProvisorio: MotorDeCitacao = {
  id: 'provisorio@m1',
  formatar(citacao, _ctx) {
    const diagnosticos: Diagnostic[] = [];
    const partes: PublicationInline[] = [];

    citacao.items.forEach((item, i) => {
      if (i > 0) partes.push({ type: 'text', value: '; ' });

      const local = item.locator !== undefined ? `, ${item.locator.value}` : '';
      partes.push({ type: 'text', value: `${item.referenceId}${local}` });
    });

    diagnosticos.push({
      id: 'CIT-MOTOR-PROVISORIO',
      severity: 'warning',
      message:
        'Citação formatada por motor provisório, não conforme ABNT. ' +
        'Este profile precisa registrar um motor de citação explícito.',
      nodeId: citacao.id,
      ...(citacao.source !== undefined ? { source: citacao.source } : {}),
    });

    return {
      conteudo: [{ type: 'text', value: '(' }, ...partes, { type: 'text', value: ')' }],
      diagnosticos,
    };
  },
};
