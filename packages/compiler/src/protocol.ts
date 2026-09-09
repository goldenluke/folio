import {
  asDocumentId,
  asNodeId,
  asReferenceId,
  asResourceId,
  type BibliographicEntity,
  type Diagnostic,
  type Registry,
} from '@abnt/document-model';
import type { ResolvedDocument } from '@abnt/semantics';
import {
  asContentHash,
  type CompilationEnvironment,
  type CompilationResult,
  type EnvironmentPreparation,
  type PreparedCompilation,
  type SourceSnapshot,
} from './model.js';
import {
  protocolError,
  protocolOk,
  type BibliographicEntityDto,
  type CompilationEnvironmentDto,
  type CompilationResultDto,
  type CompilerPrepareRequest,
  type CompilerService,
  type DiagnosticDto,
  type EnvironmentPreparationDto,
  type PreparedCompilationDto,
  type ResolvedDocumentDto,
} from '@abnt/protocol';

import { criarCompiler } from './compiler.js';
import type { HeadlessCompiler } from './model.js';
import { profileManifests } from './profiles.js';

const serializarDiagnostico = (diagnostic: Diagnostic): DiagnosticDto => ({
  id: diagnostic.id,
  severity: diagnostic.severity,
  message: diagnostic.message,
  ...(diagnostic.nodeId !== undefined ? { nodeId: String(diagnostic.nodeId) } : {}),
  ...(diagnostic.source !== undefined
    ? {
        source: {
          documentId: String(diagnostic.source.documentId),
          start: diagnostic.source.start,
          end: diagnostic.source.end,
        },
      }
    : {}),
});

const serializarDiagnosticos = (diagnostics: readonly Diagnostic[]): readonly DiagnosticDto[] =>
  diagnostics.map(serializarDiagnostico);

const deserializarDiagnostico = (diagnostic: DiagnosticDto): Diagnostic => ({
  id: diagnostic.id,
  severity: diagnostic.severity,
  message: diagnostic.message,
  ...(diagnostic.nodeId !== undefined ? { nodeId: asNodeId(diagnostic.nodeId) } : {}),
  ...(diagnostic.source !== undefined
    ? {
        source: {
          documentId: asDocumentId(diagnostic.source.documentId),
          start: diagnostic.source.start,
          end: diagnostic.source.end,
        },
      }
    : {}),
});

const sourceParaDominio = (source: CompilerPrepareRequest['source']): SourceSnapshot => ({
  documentId: asDocumentId(source.documentId),
  revision: source.revision,
  content: source.content,
  contentHash: asContentHash(source.contentHash),
});

const sourceParaDto = (source: SourceSnapshot): CompilerPrepareRequest['source'] => ({
  documentId: String(source.documentId),
  revision: source.revision,
  content: source.content,
  contentHash: String(source.contentHash),
});

/** O schema P1 valida a forma; este adaptador restaura apenas os brands locais. */
const bibliographyParaDominio = (
  entries: CompilationEnvironmentDto['bibliography']['entries'],
): Registry<BibliographicEntity> =>
  Object.fromEntries(
    Object.entries(entries).map(([id, entry]) => [
      id,
      { ...entry, id: asReferenceId(entry.id) } as BibliographicEntity,
    ]),
  );

const bibliographyParaDto = (
  entries: Registry<BibliographicEntity>,
): Registry<BibliographicEntityDto> =>
  Object.fromEntries(
    Object.entries(entries).map(([id, entry]) => [id, { ...entry, id: String(entry.id) }]),
  );

const fonteBibliograficaParaDominio = ({
  contentHash,
  ...source
}: CompilationEnvironmentDto['bibliography']['sources'][number]) => ({
  ...source,
  ...(contentHash !== undefined ? { contentHash: asContentHash(contentHash) } : {}),
});

const recursoParaDominio = ({
  contentHash,
  resourceId,
  ...resource
}: CompilationEnvironmentDto['resources'][string]) => ({
  ...resource,
  resourceId: asResourceId(resourceId),
  ...(contentHash !== undefined ? { contentHash: asContentHash(contentHash) } : {}),
});

const fonteBibliograficaParaDto = ({ contentHash, ...source }: CompilationEnvironment['bibliography']['sources'][number]) => ({
  ...source,
  ...(contentHash !== undefined ? { contentHash: String(contentHash) } : {}),
});

const recursoParaDto = ({ contentHash, resourceId, ...resource }: CompilationEnvironment['resources'][string]) => ({
  ...resource,
  resourceId: String(resourceId),
  ...(contentHash !== undefined ? { contentHash: String(contentHash) } : {}),
});

const environmentParaDominio = (environment: CompilationEnvironmentDto): CompilationEnvironment => ({
  bibliography: {
    entries: bibliographyParaDominio(environment.bibliography.entries),
    sources: environment.bibliography.sources.map(fonteBibliograficaParaDominio),
    provenanceByReference: environment.bibliography.provenanceByReference,
  },
  resources: Object.fromEntries(
    Object.entries(environment.resources).map(([id, resource]) => [id, recursoParaDominio(resource)]),
  ),
  dependencies: {
    bibliography: environment.dependencies.bibliography.map(fonteBibliograficaParaDominio),
    resources: environment.dependencies.resources.map(recursoParaDominio),
  },
  ...(environment.configuration !== undefined ? { configuration: environment.configuration } : {}),
});

const environmentParaDto = (environment: CompilationEnvironment): CompilationEnvironmentDto => ({
  bibliography: {
    entries: bibliographyParaDto(environment.bibliography.entries),
    sources: environment.bibliography.sources.map(fonteBibliograficaParaDto),
    provenanceByReference: environment.bibliography.provenanceByReference,
  },
  resources: Object.fromEntries(
    Object.entries(environment.resources).map(([id, resource]) => [id, recursoParaDto(resource)]),
  ),
  dependencies: {
    bibliography: environment.dependencies.bibliography.map(fonteBibliograficaParaDto),
    resources: environment.dependencies.resources.map(recursoParaDto),
  },
  ...(environment.configuration !== undefined ? { configuration: environment.configuration } : {}),
});

const preparedParaDominio = (prepared: PreparedCompilationDto): PreparedCompilation => ({
  source: sourceParaDominio(prepared.source),
  document: prepared.document,
  dependencies: {
    bibliographyUris: prepared.dependencies.bibliographyUris,
    resources: prepared.dependencies.resources.map((resource) => ({
      resourceId: asResourceId(resource.resourceId),
      authoredUri: resource.authoredUri,
    })),
  },
  diagnostics: prepared.diagnostics.map(deserializarDiagnostico),
});

const preparedParaDto = (prepared: PreparedCompilation): PreparedCompilationDto => ({
  source: sourceParaDto(prepared.source),
  document: prepared.document,
  dependencies: {
    bibliographyUris: prepared.dependencies.bibliographyUris,
    resources: prepared.dependencies.resources.map((resource) => ({
      resourceId: String(resource.resourceId),
      authoredUri: resource.authoredUri,
    })),
  },
  diagnostics: serializarDiagnosticos(prepared.diagnostics),
});

const preparationParaDominio = (preparation: EnvironmentPreparationDto): EnvironmentPreparation => ({
  environment: environmentParaDominio(preparation.environment),
  diagnostics: preparation.diagnostics.map(deserializarDiagnostico),
});

/**
 * `ResolvedDocument` serializado: `Map` e `AnnotationStore` não atravessam
 * IPC. Exportado porque um segundo consumidor precisa da mesma projeção sem
 * duplicá-la — o Plugin Host (P15) manda essa DTO para plugins de lint de
 * terceiros, que não têm acesso ao `ResolvedDocument` em memória.
 */
export const resolvedDocumentParaDto = (resolved: ResolvedDocument): ResolvedDocumentDto => ({
  ast: resolved.ast,
  bibliography: bibliographyParaDto(resolved.bibliography),
  annotations: resolved.annotations.toJSON(),
  diagnostics: serializarDiagnosticos(resolved.diagnostics),
  identifiers: Object.fromEntries(
    [...resolved.identifiers.entries()].map(([identifier, nodeId]) => [identifier, String(nodeId)]),
  ),
  citations: {
    citedReferenceIds: resolved.citations.citedReferenceIds.map(String),
    numberByReference: Object.fromEntries(
      [...resolved.citations.numberByReference.entries()].map(([id, number]) => [String(id), number]),
    ),
    yearSuffixByReference: Object.fromEntries(
      [...resolved.citations.yearSuffixByReference.entries()].map(([id, suffix]) => [String(id), suffix]),
    ),
  },
});

const serializarResultado = (result: CompilationResult): CompilationResultDto => ({
  unit: {
    document: result.unit.document,
    environment: environmentParaDto(result.unit.environment),
  },
  documentId: String(result.documentId),
  revision: result.revision,
  contentHash: String(result.contentHash),
  profileId: result.profileId,
  ast: result.ast,
  resolved: resolvedDocumentParaDto(result.resolved),
  validation: {
    standards: result.validation.normas,
    diagnostics: serializarDiagnosticos(result.validation.diagnostics),
    errors: result.validation.errors,
    warnings: result.validation.warnings,
  },
  publication: result.publication,
  diagnostics: serializarDiagnosticos(result.diagnostics),
});

const erroDoCompiler = (error: unknown, signal?: AbortSignal) => {
  if (signal?.aborted === true || (error instanceof Error && error.message === 'Compilação cancelada.')) {
    return protocolError('CANCELLED', 'Compilação cancelada.');
  }
  return protocolError('INTERNAL', 'O compilador não conseguiu concluir a operação.');
};

/**
 * Adapta o compilador puro ao contrato serializável. Não há transporte aqui:
 * `@abnt/protocol` decide se o serviço será chamado localmente ou via port.
 */
export function criarServicoDeCompiler(compiler: HeadlessCompiler = criarCompiler()): CompilerService {
  return {
    async profiles(_request, signal) {
      try {
        if (signal?.aborted === true) return protocolError('CANCELLED', 'Compilação cancelada.');
        return protocolOk(profileManifests());
      } catch (error) {
        return erroDoCompiler(error, signal);
      }
    },
    async prepare(request, signal) {
      try {
        const prepared = await compiler.prepare(sourceParaDominio(request.source), signal);
        return protocolOk(preparedParaDto(prepared));
      } catch (error) {
        return erroDoCompiler(error, signal);
      }
    },
    async compile(request, signal) {
      try {
        const result = await compiler.compile(
          {
            prepared: preparedParaDominio(request.prepared),
            environment: preparationParaDominio(request.environment),
            ...(request.profileId !== undefined ? { profileId: request.profileId } : {}),
          },
          signal,
        );
        return protocolOk(serializarResultado(result));
      } catch (error) {
        return erroDoCompiler(error, signal);
      }
    },
  };
}
