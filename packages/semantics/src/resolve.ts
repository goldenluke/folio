import type {
  BibliographicEntity,
  Diagnostic,
  DocumentAst,
  NodeId,
  Registry,
} from '@abnt/document-model';

import { AnnotationStore } from './annotations.js';
import {
  indexarIdentificadoresComDiagnosticos,
  numerarElementos,
} from './passes/elements.js';
import { resolverCitacoes, type CitationResolution } from './passes/citations.js';
import { resolverReferenciasCruzadas } from './passes/cross-references.js';
import { normalizarDocumento } from './passes/normalization.js';
import { numerarSecoes, type OpcoesDeNumeracao } from './passes/numbering.js';
import { executarPasses, type SemanticPass } from './passes/pipeline.js';

/**
 * A AST mais tudo que o compilador derivou dela.
 *
 * É este objeto — não a AST crua — que o motor de normas e o compilador de
 * publicação consomem.
 */
export interface ResolvedDocument {
  readonly ast: DocumentAst;
  /** Bibliografia efetiva: autoria + ambiente, sem hidratar a Document AST. */
  readonly bibliography: Registry<BibliographicEntity>;
  readonly annotations: AnnotationStore;
  readonly diagnostics: readonly Diagnostic[];
  /** Identificadores declarados pelo autor, para referência cruzada. */
  readonly identifiers: ReadonlyMap<string, NodeId>;
  readonly citations: CitationResolution;
}

export interface OpcoesDeResolucao {
  readonly numeracao?: OpcoesDeNumeracao;
  /** Registry efetivo fornecido pelo host/compilador; fallback é `ast.references`. */
  readonly bibliography?: Registry<BibliographicEntity>;
}

export interface EstadoSemantico {
  readonly ast: DocumentAst;
  readonly bibliography: Registry<BibliographicEntity>;
  readonly annotations: AnnotationStore;
  readonly diagnostics: readonly Diagnostic[];
  readonly identifiers: ReadonlyMap<string, NodeId>;
  readonly citations: CitationResolution;
}

export interface ContextoSemantico {
  readonly opcoes: OpcoesDeResolucao;
}

const CITACOES_VAZIAS: CitationResolution = {
  citedReferenceIds: [],
  numberByReference: new Map(),
  yearSuffixByReference: new Map(),
};

const substituirDiagnosticos = (
  state: EstadoSemantico,
  diagnostics: readonly Diagnostic[],
): EstadoSemantico => ({ ...state, diagnostics: [...state.diagnostics, ...diagnostics] });

export const PASSES_SEMANTICOS: readonly SemanticPass<
  EstadoSemantico,
  EstadoSemantico,
  ContextoSemantico
>[] = [
  {
    id: 'semantic:normalize',
    execute: (state) => ({ ...state, ast: normalizarDocumento(state.ast) }),
  },
  {
    id: 'semantic:number-sections',
    execute: (state, context) => {
      numerarSecoes(state.ast, state.annotations, context.opcoes.numeracao ?? {});
      return state;
    },
  },
  {
    id: 'semantic:number-elements',
    execute: (state) => {
      numerarElementos(state.ast, state.annotations);
      return state;
    },
  },
  {
    id: 'semantic:index-identifiers',
    execute: (state) => {
      const indexed = indexarIdentificadoresComDiagnosticos(state.ast);
      return substituirDiagnosticos({ ...state, identifiers: indexed.identifiers }, indexed.diagnostics);
    },
  },
  {
    id: 'semantic:resolve-citations',
    execute: (state) => {
      const resolved = resolverCitacoes(state.ast, state.bibliography);
      return substituirDiagnosticos({ ...state, citations: resolved.resolution }, resolved.diagnostics);
    },
  },
  {
    id: 'semantic:resolve-cross-references',
    execute: (state) =>
      substituirDiagnosticos(
        state,
        resolverReferenciasCruzadas(state.ast, state.annotations, state.identifiers),
      ),
  },
];

/** Executa a cadeia padrão; exposta para testes isolados e futuro cache incremental. */
export function executarPassesSemanticos(
  ast: DocumentAst,
  opcoes: OpcoesDeResolucao = {},
): EstadoSemantico {
  return executarPasses(
    {
      ast,
      bibliography: opcoes.bibliography ?? ast.references,
      annotations: new AnnotationStore(),
      diagnostics: [],
      identifiers: new Map(),
      citations: CITACOES_VAZIAS,
    },
    PASSES_SEMANTICOS,
    { opcoes },
  );
}

/**
 * Roda os passes semânticos sobre a AST.
 *
 * O encadeamento explícito importa mais que a quantidade: a alternativa é um
 * `compileDocument()` monolítico que ninguém consegue testar por partes nem
 * tornar incremental depois.
 *
 * Ordem prevista para os próximos milestones:
 *   normalização -> entidades -> citações (M2) -> cross-references (M3)
 *   -> recursos -> numeração -> grafo semântico
 */
export function resolverDocumento(
  ast: DocumentAst,
  opcoes: OpcoesDeResolucao = {},
): ResolvedDocument {
  const state = executarPassesSemanticos(ast, opcoes);
  return {
    ast: state.ast,
    bibliography: state.bibliography,
    annotations: state.annotations,
    diagnostics: state.diagnostics,
    identifiers: state.identifiers,
    citations: state.citations,
  };
}
