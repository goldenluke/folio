import type {
  BibliographicEntity,
  Diagnostic,
  DocumentAst,
  Registry,
  Resource,
} from '@abnt/document-model';
import { parseMarkdownComDiagnosticos } from '@abnt/markdown';
import { compilarPublicacao } from '@abnt/publication';
import { resolverDocumento } from '@abnt/semantics';

import type {
  AuthoredDependencies,
  CompilationEnvironment,
  CompilationProfileDefinition,
  CompilationProfileRegistry,
  HeadlessCompiler,
} from './model.js';
import { REGISTRO_DE_PERFIS_PADRAO } from './profiles.js';

export interface CompilerOptions {
  readonly profiles?: CompilationProfileRegistry;
}

const checkCancelled = (signal?: AbortSignal): void => {
  if (signal?.aborted === true) throw new Error('Compilação cancelada.');
};

const bibliographyUris = (ast: DocumentAst): readonly string[] => {
  const raw = ast.document.metadata.properties?.['bibliography:files'];
  return Array.isArray(raw) ? raw.filter((entry): entry is string => typeof entry === 'string') : [];
};

export const authoredDependencies = (ast: DocumentAst): AuthoredDependencies => ({
  bibliographyUris: bibliographyUris(ast),
  resources: Object.values(ast.resources).map((resource) => ({
    resourceId: resource.id,
    authoredUri: resource.uri,
  })),
});

const profileIdFor = (
  ast: DocumentAst,
  environment: CompilationEnvironment,
  registry: CompilationProfileRegistry,
  override: string | undefined,
): string => {
  if (override !== undefined) return override;

  const declared = ast.document.metadata.properties?.['publication:profile'];
  if (typeof declared === 'string') return declared;

  const citationSystem = ast.document.metadata.properties?.['citation:system'];
  if (citationSystem === 'numeric' || citationSystem === 'numerico') return 'abnt-artigo-numerico';

  return environment.configuration?.defaultProfileId ?? registry.defaultProfileId;
};

const getProfile = (
  registry: CompilationProfileRegistry,
  id: string,
): CompilationProfileDefinition => {
  const definition = registry.profiles[id];
  if (definition !== undefined) return definition;
  throw new Error(
    `Perfil desconhecido: "${id}". Disponíveis: ${Object.keys(registry.profiles).join(', ')}.`,
  );
};

/**
 * Junta autoria e ambiente sem alterar a árvore autoral. Entradas declaradas
 * no documento têm precedência e colisões ficam explícitas em diagnósticos.
 */
const effectiveBibliography = (
  ast: DocumentAst,
  environment: CompilationEnvironment,
): { readonly entries: Registry<BibliographicEntity>; readonly diagnostics: readonly Diagnostic[] } => {
  const diagnostics: Diagnostic[] = [];
  const entries: Record<string, BibliographicEntity> = { ...environment.bibliography.entries };

  for (const [id, entry] of Object.entries(ast.references)) {
    if (entries[id] !== undefined) {
      diagnostics.push({
        id: 'BIBLIOGRAFIA-CHAVE-DUPLICADA',
        severity: 'error',
        message: `A chave bibliográfica "${id}" aparece no documento e no ambiente de compilação.`,
      });
    }
    entries[id] = entry;
  }

  return { entries, diagnostics };
};

/** Projeção efêmera para o Publication AST; a Resource autoral nunca é reescrita. */
const effectiveResources = (
  ast: DocumentAst,
  environment: CompilationEnvironment,
): Registry<Resource> => {
  const resources: Record<string, Resource> = {};

  for (const [id, resource] of Object.entries(ast.resources)) {
    const resolution = environment.resources[id];
    resources[id] =
      resolution?.resolvedUri === undefined
        ? resource
        : {
            ...resource,
            uri: resolution.resolvedUri,
            ...(resolution.mediaType !== undefined ? { mediaType: resolution.mediaType } : {}),
          };
  }

  return resources;
};

/**
 * Orquestrador puro de I/O. `prepare` descobre dependências e `compile`
 * recebe o ambiente já materializado pelo host (CLI, desktop ou language service).
 */
export function criarCompiler(options: CompilerOptions = {}): HeadlessCompiler {
  const registry = options.profiles ?? REGISTRO_DE_PERFIS_PADRAO;

  return {
    async prepare(source, signal) {
      checkCancelled(signal);
      const parsed = parseMarkdownComDiagnosticos(source.content, {
        documentId: String(source.documentId),
      });
      checkCancelled(signal);

      return {
        source,
        document: parsed.ast,
        dependencies: authoredDependencies(parsed.ast),
        diagnostics: parsed.diagnostics,
      };
    },

    async compile(request, signal) {
      checkCancelled(signal);
      const { prepared } = request;
      const environment = request.environment.environment;
      const profileId = profileIdFor(prepared.document, environment, registry, request.profileId);
      const definition = getProfile(registry, profileId);
      const bibliography = effectiveBibliography(prepared.document, environment);
      checkCancelled(signal);

      const resolved = resolverDocumento(prepared.document, {
        bibliography: bibliography.entries,
        numeracao: {
          ...(definition.profile.secoesSemNumeracao !== undefined
            ? { semNumeracao: definition.profile.secoesSemNumeracao }
            : {}),
        },
      });
      checkCancelled(signal);

      const validation = definition.validar(resolved);
      checkCancelled(signal);

      const publication = compilarPublicacao(resolved, definition.profile, {
        resources: effectiveResources(prepared.document, environment),
      });
      checkCancelled(signal);

      return {
        unit: { document: prepared.document, environment },
        documentId: prepared.source.documentId,
        revision: prepared.source.revision,
        contentHash: prepared.source.contentHash,
        profileId,
        ast: prepared.document,
        resolved,
        validation,
        publication: publication.documento,
        diagnostics: [
          ...prepared.diagnostics,
          ...request.environment.diagnostics,
          ...bibliography.diagnostics,
          ...validation.diagnostics,
          ...publication.diagnosticos,
        ],
      };
    },
  };
}
