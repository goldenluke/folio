import { z } from 'zod';

import type { DocumentAst } from '../document.js';
import { cslBibliographicEntityV1, documentAstV1, SCHEMA_ID, SCHEMA_VERSION } from './v1.js';

export { cslBibliographicEntityV1, documentAstV1, SCHEMA_ID, SCHEMA_VERSION };

export interface ProblemaDeValidacao {
  /** Caminho até o campo problemático: `document.children.2.children.0.value`. */
  readonly caminho: string;
  readonly mensagem: string;
}

export type ResultadoDeValidacao =
  | { readonly ok: true; readonly valor: DocumentAst }
  | { readonly ok: false; readonly problemas: readonly ProblemaDeValidacao[] };

/**
 * Valida um valor desconhecido como Document AST v1.
 *
 * Devolve resultado em vez de lançar: dado inválido vindo de arquivo ou de
 * plugin é situação esperada, não excepcional, e quem chama precisa poder
 * reportar os problemas ao usuário em vez de derrubar o processo.
 */
export function validarDocumentAst(bruto: unknown): ResultadoDeValidacao {
  const resultado = documentAstV1.safeParse(bruto);

  if (resultado.success) {
    // A asserção é o ponto exato onde `unknown` vira tipado, e está
    // justificada pela validação imediatamente acima. Ver a nota sobre tipos
    // branded em schema/v1.ts.
    return { ok: true, valor: resultado.data as unknown as DocumentAst };
  }

  return {
    ok: false,
    problemas: resultado.error.issues.map((issue) => ({
      caminho: issue.path.length > 0 ? issue.path.join('.') : '(raiz)',
      mensagem: issue.message,
    })),
  };
}

export class DocumentAstInvalido extends Error {
  constructor(readonly problemas: readonly ProblemaDeValidacao[]) {
    const resumo = problemas
      .slice(0, 5)
      .map((p) => `  ${p.caminho}: ${p.mensagem}`)
      .join('\n');
    const resto = problemas.length > 5 ? `\n  ... e mais ${problemas.length - 5}` : '';
    super(`Document AST inválida:\n${resumo}${resto}`);
    this.name = 'DocumentAstInvalido';
  }
}

/** Igual a `validarDocumentAst`, mas lança. Use quando a falha for um bug. */
export function assertirDocumentAst(bruto: unknown): DocumentAst {
  const r = validarDocumentAst(bruto);
  if (!r.ok) throw new DocumentAstInvalido(r.problemas);
  return r.valor;
}

// ---------------------------------------------------------------------------
// Migração
// ---------------------------------------------------------------------------

/**
 * Uma migração leva o formato de uma versão para a seguinte.
 *
 * Trabalham sobre `unknown`: a forma de origem é a de uma versão antiga, para a
 * qual não existem mais tipos no código — mantê-los só para migração faria o
 * modelo carregar para sempre todas as formas que já teve.
 */
export interface Migracao {
  readonly de: number;
  readonly para: number;
  readonly descricao: string;
  aplicar(bruto: Record<string, unknown>): Record<string, unknown>;
}

/**
 * Cadeia de migrações, em ordem.
 *
 * Vazia hoje porque só existe a v1. A estrutura existe desde já por decisão
 * explícita: a alternativa é evoluir o formato acrescentando campo opcional
 * atrás de campo opcional até que ninguém saiba mais quais combinações são
 * válidas. Quando a v2 chegar, a migração entra aqui e
 * `tests/schema.test.ts` passa a rodar os fixtures antigos contra ela.
 *
 * Regra: migração nunca é opcional nem silenciosa. Documento de versão
 * desconhecida falha com mensagem clara, e não é aberto "na esperança".
 */
const MIGRACOES: readonly Migracao[] = [
  // Exemplo da forma que uma migração terá:
  // {
  //   de: 1,
  //   para: 2,
  //   descricao: 'separa Caption.short em short/long',
  //   aplicar: (bruto) => ({ ...bruto, version: 2 }),
  // },
];

export class VersaoNaoSuportada extends Error {
  constructor(
    readonly encontrada: unknown,
    readonly suportada: number,
  ) {
    super(
      `Versão de schema não suportada: ${JSON.stringify(encontrada)}. ` +
        `Esta build entende até a v${suportada}. ` +
        'Um documento gravado por uma versão mais nova precisa de uma build mais nova.',
    );
    this.name = 'VersaoNaoSuportada';
  }
}

const envelope = z.object({
  schema: z.literal(SCHEMA_ID),
  version: z.number().int().positive(),
});

/**
 * Lê um Document AST de qualquer versão conhecida, migrando até a atual.
 *
 * É este o ponto de entrada para carregar `.ast.json` de disco — não
 * `validarDocumentAst` direto, que só aceita a versão corrente.
 */
export function carregarDocumentAst(bruto: unknown): ResultadoDeValidacao {
  const cabecalho = envelope.safeParse(bruto);
  if (!cabecalho.success) {
    return {
      ok: false,
      problemas: [
        {
          caminho: '(raiz)',
          mensagem: `Não parece um documento "${SCHEMA_ID}": faltam os campos schema/version.`,
        },
      ],
    };
  }

  let versao = cabecalho.data.version;
  if (versao > SCHEMA_VERSION) throw new VersaoNaoSuportada(versao, SCHEMA_VERSION);

  let atual = bruto as Record<string, unknown>;

  while (versao < SCHEMA_VERSION) {
    const migracao = MIGRACOES.find((m) => m.de === versao);
    if (migracao === undefined) throw new VersaoNaoSuportada(versao, SCHEMA_VERSION);
    atual = migracao.aplicar(atual);
    versao = migracao.para;
  }

  return validarDocumentAst(atual);
}

/** Migrações registradas, para diagnóstico e teste. */
export const migracoesRegistradas = (): readonly Migracao[] => MIGRACOES;

// ---------------------------------------------------------------------------
// JSON Schema
// ---------------------------------------------------------------------------

/**
 * Gera o JSON Schema do formato.
 *
 * Publicar isso é o que permite validar, ler e escrever `document-ast` fora do
 * TypeScript — plugins em outra linguagem, ferramentas de terceiros, pipelines
 * de CI. É o motivo de o formato não ser especificado só por interfaces TS.
 */
export function gerarJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(documentAstV1, { target: 'draft-2020-12' }) as Record<string, unknown>;
}
