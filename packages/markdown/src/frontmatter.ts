import { parse as parseYaml } from 'yaml';

export interface ProblemaDeFrontmatter {
  readonly mensagem: string;
  /** Offset no arquivo onde o bloco de frontmatter começa. */
  readonly offset: number;
}

export interface FrontmatterExtraida {
  /** Objeto YAML já parseado; `{}` quando não há frontmatter ou ele é inválido. */
  readonly dados: Record<string, unknown>;
  /** Corpo Markdown, sem o bloco de frontmatter. */
  readonly corpo: string;
  /**
   * Offset, no texto ORIGINAL, onde o corpo começa.
   *
   * Todo offset calculado sobre `corpo` precisa somar este valor antes de virar
   * um SourceRange, senão os diagnósticos apontam para a linha errada — o erro
   * cresce exatamente com o tamanho do frontmatter, que é justamente onde os
   * documentos acadêmicos são mais verbosos.
   */
  readonly offsetDoCorpo: number;
  readonly problema?: ProblemaDeFrontmatter;
}

/** `---` na primeira linha, YAML, e `---` (ou `...`) fechando numa linha só dele. */
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;

const SEM_FRONTMATTER = (fonte: string): FrontmatterExtraida => ({
  dados: {},
  corpo: fonte,
  offsetDoCorpo: 0,
});

/**
 * Separa o frontmatter YAML do corpo Markdown.
 *
 * YAML inválido NÃO derruba o parse. Duas razões: `---` na primeira linha
 * costuma ser uma linha horizontal, não intenção de frontmatter, e nesse caso
 * tratar o bloco como corpo é o que o autor quis; e mesmo quando é frontmatter
 * de verdade, um erro de digitação em YAML precisa virar diagnóstico com
 * posição, não uma exceção que interrompe a compilação inteira.
 *
 * (Este comportamento foi descoberto por teste de propriedade: a entrada
 * mínima `---\n\n- , \n\n---` fazia o compilador lançar.)
 */
export function extrairFrontmatter(fonte: string): FrontmatterExtraida {
  const m = FRONTMATTER.exec(fonte);
  if (m === null) return SEM_FRONTMATTER(fonte);

  const [bloco, yaml = ''] = m;

  let parsed: unknown;
  try {
    parsed = parseYaml(yaml, { uniqueKeys: true });
  } catch (erro) {
    return {
      ...SEM_FRONTMATTER(fonte),
      problema: {
        mensagem: `Frontmatter YAML inválido, ignorado: ${(erro as Error).message.split('\n')[0]}`,
        offset: 0,
      },
    };
  }

  // YAML válido mas que não é um mapa (uma lista, um escalar) não descreve
  // metadados. Mesmo tratamento: vira corpo, com aviso.
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      ...SEM_FRONTMATTER(fonte),
      problema: {
        mensagem: 'Frontmatter não é um mapa de chave/valor; ignorado.',
        offset: 0,
      },
    };
  }

  return {
    dados: parsed as Record<string, unknown>,
    corpo: fonte.slice(bloco.length),
    offsetDoCorpo: bloco.length,
  };
}
