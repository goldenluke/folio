import { validarDocumentAst, cslBibliographicEntityV1, type DocumentAst } from '@abnt/document-model';
import type { PublicationDocument } from '@abnt/publication';
import { z } from 'zod';

import {
  PROTOCOL_VERSION,
  protocolError,
  protocolOk,
  type CompilationResultDto,
  type CompilerCompileRequest,
  type CompilerProfilesRequest,
  type PublicationProfileManifestDto,
  type CompilerPrepareRequest,
  type EnvironmentPreparationDto,
  type PreparedCompilationDto,
  type ProtocolEnvelope,
  type ProtocolError,
  type ProtocolMethod,
  type ProtocolProblem,
  type ProtocolResult,
  type ProtocolResponseEnvelope,
  type ResolvedDocumentDto,
  type SourceSnapshotDto,
  type SystemInformationDto,
  type WorkspaceFileDto,
  type WorkspaceEvent,
  type WorkspaceBacklinkDto,
  type WorkspaceBacklinksRequest,
  type WorkspaceListRequest,
  type WorkspaceReadRequest,
  type WorkspaceReadResponse,
  type WorkspaceReferenceDto,
  type WorkspaceReferencesRequest,
  type WorkspaceRenameRequest,
  type WorkspaceSearchRequest,
  type WorkspaceSearchResultDto,
  type WorkspaceProblemsRequest,
  type WorkspaceProfilesRequest,
  type WorkspaceProfileValidationPreviewRequest,
  type WorkspaceProfileValidationPreviewDto,
  type WorkspacePluginDto,
  type WorkspacePluginSetEnabledRequest,
  type WorkspacePluginCommandRequest,
  type WorkspacePluginCommandResultDto,
  type DesktopPluginExportRequest,
  type WorkspacePluginExportRequest,
  type WorkspacePluginExportDto,
  type WorkspaceProblemDto,
  type WorkspaceGraphRequest,
  type WorkspaceGraphDto,
  type WorkspaceGraphNodeDto,
  type WorkspaceGraphEdgeDto,
  type WorkspaceHistoryRequest,
  type WorkspaceHistoryDto,
  type WorkspaceHistorySnapshotRequest,
  type WorkspaceHistoryReadRequest,
  type WorkspaceHistoryDiffRequest,
  type WorkspaceHistoryDiffDto,
  type WorkspaceHistoryStructuralDiffDto,
  type WorkspaceDocumentComparisonRequest,
  type WorkspaceDocumentComparisonDto,
  type WorkspaceCreateLiteratureNoteRequest,
  type WorkspaceCitationExplorerRequest,
  type WorkspaceCitationExplorerResponseDto,
  type CitationExplorerEntryDto,
  type CitationExplorerLocationDto,
  type WorkspaceResearchOverviewRequest,
  type WorkspaceResearchOverviewDto,
  type WorkspaceProjectDashboardRequest,
  type WorkspaceProjectDashboardDto,
  type WorkspaceResearchReferenceDto,
  type WorkspaceLiteratureReviewDto,
  type WorkspaceLibraryListRequest,
  type WorkspaceLibraryUpsertRequest,
  type WorkspaceLibraryRemoveRequest,
  type WorkspaceLibraryFormatRequest,
  type WorkspaceLibraryResolveDoiRequest,
  type WorkspaceLibraryImportRequest,
  type WorkspaceLibraryImportResponseDto,
  type WorkspaceLibraryIntakePreviewRequest,
  type WorkspaceLibraryIntakePreviewDto,
  type WorkspaceLibraryDuplicatesRequest,
  type WorkspaceLibraryDuplicateDto,
  type WorkspaceLibraryMergeRequest,
  type WorkspaceLibraryMergeResponseDto,
  type WorkspaceLibraryKeyPreviewRequest,
  type WorkspaceLibraryKeyPreviewDto,
  type WorkspaceLibraryRenameKeyRequest,
  type WorkspaceLibraryRenameKeyResponseDto,
  type WorkspaceReferenceHealthRequest,
  type WorkspaceImportAssetRequest,
  type WorkspaceAssetDto,
  type EditorImportAssetRequest,
  type WorkspaceCreateDocumentRequest,
  type WorkspaceReferenceHealthDto,
  type WorkspaceReferenceAttachmentDto,
  type WorkspaceReferenceAttachmentsRequest,
  type WorkspaceAttachReferencePdfRequest,
  type WorkspaceReferenceAttachmentRequest,
  type WorkspaceReferencePdfDto,
  type WorkspacePdfAnnotationDto,
  type WorkspaceCreatePdfAnnotationRequest,
  type WorkspacePdfAnnotationRequest,
  type WorkspacePdfAnnotationLinkDto,
  type WorkspaceWriteRequest,
  type WorkspaceOpenRequest,
  type WorkspaceOpenResponse,
  type DesktopExportRequest,
  type EditorCloseRequest,
  type EditorDispatchRequest,
  type EditorExportDto,
  type EditorExportRequest,
  type EditorExportResultDto,
  type EditorOpenRequest,
  type EditorPreviewDto,
  type EditorPreviewRequest,
  type EditorResolveConflictRequest,
  type EditorSaveRequest,
  type EditorSnapshotDto,
  type EditorSnapshotRequest,
  type DesktopEventDto,
  type BibliographicEntityDto,
  type DiagnosticDto,
  type ExportFormat,
  type ExportRequest,
  type ExportResultDto,
  type LanguageCompletionDto,
  type LanguageCompletionRequest,
  type LanguageDefinitionRequest,
  type LanguageHoverDto,
  type LanguageHoverRequest,
  type LanguageLocationDto,
  type LanguageReferencesRequest,
  type LanguageWritingStatisticsRequest,
  type LanguageWritingStatisticsDto,
  type LanguageRenameRequest,
  type LanguageRenameResultDto,
  type LanguageMoveSectionRequest,
} from './model.js';

const nonEmptyString = z.string().min(1);
const nonNegativeInteger = z.number().int().nonnegative();

export const systemInformationDtoSchema = z.object({
  schemaVersion: z.literal(1),
  product: z.literal('Folio'),
  appVersion: nonEmptyString,
  commit: nonEmptyString,
  channel: z.enum(['development', 'preview', 'stable']),
  platform: nonEmptyString,
  architecture: nonEmptyString,
  electronVersion: nonEmptyString,
  protocolVersion: nonNegativeInteger,
  workspaceConfigSchemaVersion: nonNegativeInteger,
  workspaceStateSchemaVersion: nonNegativeInteger,
  workspaceIndexSchemaVersion: nonNegativeInteger,
  pluginApiVersion: nonNegativeInteger,
}) as z.ZodType<SystemInformationDto>;

const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

const sourcePositionSchema = z.object({
  offset: nonNegativeInteger,
  line: z.number().int().positive().optional(),
  column: z.number().int().positive().optional(),
});

const sourceRangeSchema = z.object({
  documentId: nonEmptyString,
  start: sourcePositionSchema,
  end: sourcePositionSchema,
});

export const diagnosticDtoSchema = z.object({
  id: nonEmptyString,
  severity: z.enum(['info', 'warning', 'error']),
  message: z.string(),
  nodeId: nonEmptyString.optional(),
  source: sourceRangeSchema.optional(),
}) as z.ZodType<DiagnosticDto>;

/** Reutiliza a especificação canônica, em vez de manter uma cópia do schema da AST. */
export const documentAstDtoSchema = z.custom<DocumentAst>(
  (value) => validarDocumentAst(value).ok,
  { message: 'Document AST inválida.' },
);

export const sourceSnapshotDtoSchema = z.object({
  documentId: nonEmptyString,
  revision: nonNegativeInteger,
  content: z.string(),
  contentHash: nonEmptyString,
}) as z.ZodType<SourceSnapshotDto>;

const bibliographySourceSchema = z.object({
  id: nonEmptyString,
  authoredUri: nonEmptyString.optional(),
  resolvedUri: nonEmptyString.optional(),
  format: z.enum(['bibtex', 'csl-json', 'ris', 'memory', 'remote']),
  contentHash: nonEmptyString.optional(),
});

const resourceResolutionSchema = z.object({
  resourceId: nonEmptyString,
  authoredUri: nonEmptyString,
  status: z.enum(['resolved', 'external', 'missing', 'blocked']),
  resolvedUri: nonEmptyString.optional(),
  mediaType: nonEmptyString.optional(),
  contentHash: nonEmptyString.optional(),
});

const bibliographyEntrySchema = z.custom<BibliographicEntityDto>((value) => cslBibliographicEntityV1.safeParse(value).success, {
  message: 'Entrada bibliográfica CSL-JSON inválida.',
});

const bibliographyEnvironmentSchema = z.object({
  entries: z.record(z.string(), bibliographyEntrySchema),
  sources: z.array(bibliographySourceSchema),
  provenanceByReference: z.record(
    z.string(),
    z.array(
      z.object({
        sourceId: nonEmptyString,
        sourceUri: nonEmptyString.optional(),
      }),
    ),
  ),
});

const compilationEnvironmentSchema = z.object({
  bibliography: bibliographyEnvironmentSchema,
  resources: z.record(z.string(), resourceResolutionSchema),
  dependencies: z.object({
    bibliography: z.array(bibliographySourceSchema),
    resources: z.array(resourceResolutionSchema),
  }),
  configuration: z
    .object({
      defaultProfileId: nonEmptyString.optional(),
    })
    .optional(),
});

export const environmentPreparationDtoSchema = z.object({
  environment: compilationEnvironmentSchema,
  diagnostics: z.array(diagnosticDtoSchema),
}) as z.ZodType<EnvironmentPreparationDto>;

export const preparedCompilationDtoSchema = z.object({
  source: sourceSnapshotDtoSchema,
  document: documentAstDtoSchema,
  dependencies: z.object({
    bibliographyUris: z.array(nonEmptyString),
    resources: z.array(
      z.object({
        resourceId: nonEmptyString,
        authoredUri: nonEmptyString,
      }),
    ),
  }),
  diagnostics: z.array(diagnosticDtoSchema),
}) as z.ZodType<PreparedCompilationDto>;

const publicationInlineSchema: z.ZodType<unknown> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('text'), value: z.string() }),
    z.object({
      type: z.enum(['strong', 'emphasis', 'strike', 'code']),
      children: z.array(publicationInlineSchema),
    }),
    z.object({ type: z.literal('link'), url: nonEmptyString, children: z.array(publicationInlineSchema) }),
    z.object({
      type: z.literal('math'),
      display: z.boolean(),
      language: nonEmptyString,
      value: z.string(),
    }),
    z.object({ type: z.literal('note-mark'), marker: nonEmptyString, noteId: nonEmptyString }),
  ]),
);

const publicationCaptionSchema = z.object({
  style: nonEmptyString,
  text: z.array(publicationInlineSchema),
  position: z.enum(['above', 'below']),
});

const publicationBlockSchema: z.ZodType<unknown> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('paragraph'), style: nonEmptyString, children: z.array(publicationInlineSchema) }),
    z.object({
      type: z.literal('heading'),
      level: z.number().int().positive(),
      style: nonEmptyString,
      anchor: nonEmptyString.optional(),
      number: nonEmptyString.optional(),
      children: z.array(publicationInlineSchema),
    }),
    z.object({
      type: z.literal('quote'),
      style: nonEmptyString,
      children: z.array(publicationBlockSchema),
      attribution: z.array(publicationInlineSchema).optional(),
    }),
    z.object({
      type: z.literal('list'),
      style: nonEmptyString,
      ordered: z.boolean(),
      start: z.number().int().positive().optional(),
      items: z.array(
        z.object({
          type: z.literal('list-item'),
          style: nonEmptyString,
          children: z.array(publicationBlockSchema),
        }),
      ),
    }),
    z.object({
      type: z.literal('list-item'),
      style: nonEmptyString,
      children: z.array(publicationBlockSchema),
    }),
    z.object({
      type: z.literal('figure'),
      style: nonEmptyString,
      anchor: nonEmptyString.optional(),
      src: nonEmptyString,
      alt: z.string(),
      caption: publicationCaptionSchema.optional(),
      attribution: publicationCaptionSchema.optional(),
    }),
    z.object({
      type: z.literal('table'),
      style: nonEmptyString,
      anchor: nonEmptyString.optional(),
      head: z.array(
        z.object({
          cells: z.array(
            z.object({
              children: z.array(publicationBlockSchema),
              alignment: z.enum(['left', 'right', 'center', 'justify']).optional(),
              rowSpan: z.number().int().positive().optional(),
              columnSpan: z.number().int().positive().optional(),
              header: z.boolean(),
            }),
          ),
        }),
      ),
      body: z.array(
        z.object({
          cells: z.array(
            z.object({
              children: z.array(publicationBlockSchema),
              alignment: z.enum(['left', 'right', 'center', 'justify']).optional(),
              rowSpan: z.number().int().positive().optional(),
              columnSpan: z.number().int().positive().optional(),
              header: z.boolean(),
            }),
          ),
        }),
      ),
      caption: publicationCaptionSchema.optional(),
      attribution: publicationCaptionSchema.optional(),
    }),
    z.object({
      type: z.literal('code'),
      style: nonEmptyString,
      anchor: nonEmptyString.optional(),
      language: nonEmptyString.optional(),
      value: z.string(),
      caption: publicationCaptionSchema.optional(),
    }),
    z.object({
      type: z.literal('math-block'),
      style: nonEmptyString,
      anchor: nonEmptyString.optional(),
      language: nonEmptyString,
      value: z.string(),
      caption: publicationCaptionSchema.optional(),
    }),
    z.object({ type: z.literal('thematic-break'), style: nonEmptyString }),
    z.object({
      type: z.literal('front-matter'),
      role: nonEmptyString,
      style: nonEmptyString,
      label: z.string().optional(),
      children: z.array(publicationBlockSchema),
    }),
    z.object({
      type: z.literal('toc'),
      style: nonEmptyString,
      title: z.array(publicationInlineSchema),
      entries: z.array(
        z.object({
          level: z.number().int().positive(),
          target: nonEmptyString,
          children: z.array(publicationInlineSchema),
        }),
      ),
    }),
  ]),
);

const styleDefinitionSchema = z.object({
  fontFamily: z.string().optional(),
  fontSize: z.string().optional(),
  lineHeight: z.union([z.string(), z.number()]).optional(),
  fontWeight: z.string().optional(),
  fontStyle: z.enum(['normal', 'italic']).optional(),
  textAlign: z.enum(['left', 'right', 'center', 'justify']).optional(),
  textTransform: z.enum(['none', 'uppercase']).optional(),
  marginTop: z.string().optional(),
  marginBottom: z.string().optional(),
  marginLeft: z.string().optional(),
  textIndent: z.string().optional(),
  counterReset: z.string().optional(),
  pageBreakBefore: z.boolean().optional(),
  pageBreakAfter: z.boolean().optional(),
  whiteSpace: z.enum(['normal', 'pre', 'pre-wrap']).optional(),
  border: z.string().optional(),
  padding: z.string().optional(),
  minHeight: z.string().optional(),
  pageName: z.string().optional(),
});

export const publicationDocumentDtoSchema = z.object({
  schema: z.literal('publication-ast'),
  version: z.literal(1),
  title: z.string(),
  language: nonEmptyString,
  page: z.object({
    size: z.enum(['A4', 'Letter']),
    margin: z.object({
      top: nonEmptyString,
      right: nonEmptyString,
      bottom: nonEmptyString,
      left: nonEmptyString,
    }),
    pageNumber: z.enum(['top-right', 'top-center', 'bottom-center', 'none']).optional(),
    variants: z.record(
      z.string(),
      z.object({ pageNumber: z.enum(['top-right', 'top-center', 'bottom-center', 'none']).optional() }),
    ).optional(),
  }),
  styles: z.record(z.string(), styleDefinitionSchema),
  children: z.array(publicationBlockSchema),
  notes: z.array(
    z.object({
      id: nonEmptyString,
      marker: nonEmptyString,
      kind: nonEmptyString,
      style: nonEmptyString,
      children: z.array(publicationBlockSchema),
    }),
  ),
}) as unknown as z.ZodType<PublicationDocument>;

export const resolvedDocumentDtoSchema = z.object({
  ast: documentAstDtoSchema,
  bibliography: z.record(z.string(), bibliographyEntrySchema),
  annotations: z.record(z.string(), z.record(z.string(), jsonValueSchema)),
  diagnostics: z.array(diagnosticDtoSchema),
  identifiers: z.record(z.string(), nonEmptyString),
  citations: z.object({
    citedReferenceIds: z.array(nonEmptyString),
    numberByReference: z.record(z.string(), nonNegativeInteger),
    yearSuffixByReference: z.record(z.string(), nonEmptyString),
  }),
}) as z.ZodType<ResolvedDocumentDto>;

const validationReportDtoSchema = z.object({
  standards: z.array(z.object({ id: nonEmptyString, version: nonEmptyString })),
  diagnostics: z.array(diagnosticDtoSchema),
  errors: nonNegativeInteger,
  warnings: nonNegativeInteger,
});

export const compilationResultDtoSchema = z.object({
  unit: z.object({ document: documentAstDtoSchema, environment: compilationEnvironmentSchema }),
  documentId: nonEmptyString,
  revision: nonNegativeInteger,
  contentHash: nonEmptyString,
  profileId: nonEmptyString,
  ast: documentAstDtoSchema,
  resolved: resolvedDocumentDtoSchema,
  validation: validationReportDtoSchema,
  publication: publicationDocumentDtoSchema,
  diagnostics: z.array(diagnosticDtoSchema),
}) as z.ZodType<CompilationResultDto>;

export const compilerPrepareRequestSchema = z.object({
  source: sourceSnapshotDtoSchema,
}) as z.ZodType<CompilerPrepareRequest>;

export const compilerCompileRequestSchema = z.object({
  prepared: preparedCompilationDtoSchema,
  environment: environmentPreparationDtoSchema,
  profileId: nonEmptyString.optional(),
}) as z.ZodType<CompilerCompileRequest>;
export const compilerProfilesRequestSchema = z.object({}) as z.ZodType<CompilerProfilesRequest>;
const publicationProfileManifestDtoSchema = z.object({
  id: nonEmptyString, version: nonEmptyString, name: nonEmptyString, description: z.string().optional(),
  documentKinds: z.array(nonEmptyString), citationSystem: z.string().optional(), capabilities: z.array(nonEmptyString),
  requiredMetadata: z.array(nonEmptyString), optionalMetadata: z.array(nonEmptyString),
  rules: z.array(z.object({ id: nonEmptyString, standard: z.string().optional(), description: z.string() })),
  pagePolicy: z.object({ size: z.enum(['A4', 'Letter']), margin: z.object({ top: nonEmptyString, right: nonEmptyString, bottom: nonEmptyString, left: nonEmptyString }), pageNumber: z.enum(['top-right', 'top-center', 'bottom-center', 'none']).optional() }),
  composition: z.object({ baseProfileId: nonEmptyString, overrides: z.array(nonEmptyString) }).optional(),
}) as z.ZodType<PublicationProfileManifestDto>;
export const compilerProfilesResponseSchema = z.array(publicationProfileManifestDtoSchema) as z.ZodType<readonly PublicationProfileManifestDto[]>;

const protocolProblemSchema = z.object({ path: z.string(), message: z.string() });

export const protocolErrorSchema = z.object({
  code: z.enum([
    'VALIDATION',
    'CANCELLED',
    'CONFLICT',
    'NOT_FOUND',
    'UNSUPPORTED_VERSION',
    'UNSUPPORTED_METHOD',
    'INTERNAL',
  ]),
  message: z.string(),
  problems: z.array(protocolProblemSchema).optional(),
}) as z.ZodType<ProtocolError>;

const requestEnvelopeSchema = z.object({
  version: z.number().int().positive(),
  kind: z.literal('request'),
  id: nonEmptyString,
  method: z.enum([
    'compiler/profiles',
    'compiler/prepare',
    'compiler/compile',
    'workspace/open',
    'workspace/profiles',
    'workspace/profile-validation-preview',
    'workspace/list',
    'workspace/read',
    'editor/open',
    'editor/snapshot',
    'editor/dispatch',
    'editor/save',
    'editor/close',
    'editor/resolve-conflict',
    'editor/preview',
    'editor/export',
    'workspace/search',
    'workspace/problems',
    'workspace/plugins',
    'workspace/plugin-set-enabled',
    'workspace/plugins-reload',
    'workspace/plugin-command',
    'workspace/plugin-export',
    'workspace/backlinks',
    'workspace/references',
    'workspace/graph',
    'workspace/history',
    'workspace/history-create-snapshot',
    'workspace/history-diff',
    'workspace/history-structural-diff',
    'workspace/compare-documents',
    'workspace/create-literature-note',
    'workspace/citation-explorer',
    'workspace/research-overview',
    'workspace/project-dashboard',
    'workspace/library-list',
    'workspace/library-upsert',
    'workspace/library-remove',
    'workspace/library-format',
    'workspace/library-resolve-doi',
    'workspace/library-import',
    'workspace/library-intake-preview',
    'workspace/library-duplicates',
    'workspace/library-merge',
    'workspace/library-key-preview',
    'workspace/library-rename-key',
    'workspace/reference-health',
    'workspace/reference-attachments',
    'workspace/attach-reference-pdf',
    'workspace/remove-reference-attachment',
    'workspace/reference-attachment-local-path',
    'workspace/reference-pdf',
    'workspace/pdf-annotations',
    'workspace/create-pdf-annotation',
    'workspace/remove-pdf-annotation',
    'workspace/link-pdf-annotation',
    'workspace/import-asset',
    'workspace/create-document',
    'workspace/rename-document',
    'language/completions',
    'language/hover',
    'language/definition',
    'language/references',
    'language/cross-reference-targets',
    'language/unlinked-mentions',
    'language/writing-statistics',
    'language/rename-symbol',
    'language/move-section',
    'language/unlinked-mentions',
    'export/run',
  ]),
  payload: z.unknown(),
}) as z.ZodType<{ readonly version: number; readonly kind: 'request'; readonly id: string; readonly method: ProtocolMethod; readonly payload: unknown }>;

const responseEnvelopeSchema = z.object({
  version: z.number().int().positive(),
  kind: z.literal('response'),
  id: nonEmptyString,
  result: z.object({ ok: z.boolean() }).passthrough(),
});

const cancelEnvelopeSchema = z.object({
  version: z.number().int().positive(),
  kind: z.literal('cancel'),
  id: nonEmptyString,
});

export const protocolEnvelopeSchema = z.union([
  requestEnvelopeSchema,
  responseEnvelopeSchema,
  cancelEnvelopeSchema,
]) as z.ZodType<ProtocolEnvelope>;

export const protocolResponseEnvelopeSchema = responseEnvelopeSchema as unknown as z.ZodType<ProtocolResponseEnvelope>;

const workspaceFileSchema = z.object({
  fileId: nonEmptyString,
  documentId: nonEmptyString.optional(),
  path: nonEmptyString,
  revision: nonNegativeInteger,
  contentHash: nonEmptyString,
  mediaType: nonEmptyString.optional(),
}) as z.ZodType<WorkspaceFileDto>;

/** Exportado já na P1 para que P2 não crie contratos informais. */
export const workspaceFileDtoSchema = workspaceFileSchema;

export const workspaceReadRequestSchema = z.object({
  fileId: nonEmptyString,
}) as z.ZodType<WorkspaceReadRequest>;

export const workspaceReadResponseSchema = z.object({
  file: workspaceFileSchema,
  content: z.string(),
}) as z.ZodType<WorkspaceReadResponse>;

export const workspaceWriteRequestSchema = z.object({
  fileId: nonEmptyString,
  content: z.string(),
  expectedRevision: nonNegativeInteger,
}) as z.ZodType<WorkspaceWriteRequest>;

export const workspaceRenameRequestSchema = z.object({
  fileId: nonEmptyString,
  path: nonEmptyString,
  expectedRevision: nonNegativeInteger,
}) as z.ZodType<WorkspaceRenameRequest>;

export const workspaceListRequestSchema = z.object({
  path: nonEmptyString.optional(),
}) as z.ZodType<WorkspaceListRequest>;

export const workspaceSearchRequestSchema = z.object({
  query: z.string(),
  limit: z.number().int().positive().optional(),
}) as z.ZodType<WorkspaceSearchRequest>;

export const workspaceProblemsRequestSchema = z.object({ fileIds: z.array(nonEmptyString).optional() }) as z.ZodType<WorkspaceProblemsRequest>;
export const workspaceProfilesRequestSchema = z.object({}) as z.ZodType<WorkspaceProfilesRequest>;
export const workspaceProfilesResponseSchema = compilerProfilesResponseSchema;
export const workspaceProfileValidationPreviewRequestSchema = z.object({ fileId: nonEmptyString, expectedRevision: nonNegativeInteger, profileId: nonEmptyString }) as z.ZodType<WorkspaceProfileValidationPreviewRequest>;
export const workspaceProfileValidationPreviewResponseSchema = z.object({ revision: nonNegativeInteger, profileId: nonEmptyString, errors: nonNegativeInteger, warnings: nonNegativeInteger, errorDelta: z.number().int(), warningDelta: z.number().int() }) as z.ZodType<WorkspaceProfileValidationPreviewDto>;
const workspacePluginDtoSchema = z.object({ id: nonEmptyString, version: z.string().optional(), apiVersion: nonNegativeInteger.optional(), capabilities: z.array(nonEmptyString), enabled: z.boolean(), commands: z.array(z.object({ id: nonEmptyString, title: nonEmptyString })), views: z.array(z.object({ id: nonEmptyString, title: nonEmptyString, body: z.string() })), exports: z.array(z.object({ id: nonEmptyString, title: nonEmptyString, extension: nonEmptyString, mimeType: nonEmptyString })), error: z.string().optional() }) as z.ZodType<WorkspacePluginDto>;
export const workspacePluginsResponseSchema = z.array(workspacePluginDtoSchema) as z.ZodType<readonly WorkspacePluginDto[]>;
export const workspacePluginSetEnabledRequestSchema = z.object({ id: nonEmptyString, enabled: z.boolean() }) as z.ZodType<WorkspacePluginSetEnabledRequest>;
export const workspacePluginCommandRequestSchema = z.object({ pluginId: nonEmptyString, commandId: nonEmptyString, activeFileId: nonEmptyString.optional(), activeRevision: nonNegativeInteger.optional() }) as z.ZodType<WorkspacePluginCommandRequest>;
export const workspacePluginCommandResponseSchema = z.object({ kind: z.enum(['notice', 'open-view']), message: z.string().optional(), viewId: nonEmptyString.optional() }) as z.ZodType<WorkspacePluginCommandResultDto>;
export const desktopPluginExportRequestSchema = z.object({ fileId: nonEmptyString, expectedRevision: nonNegativeInteger, pluginId: nonEmptyString, exportId: nonEmptyString }) as z.ZodType<DesktopPluginExportRequest>;
export const workspacePluginExportRequestSchema = desktopPluginExportRequestSchema as z.ZodType<WorkspacePluginExportRequest>;
export const workspacePluginExportResponseSchema = z.object({ title: z.string(), extension: nonEmptyString, mimeType: nonEmptyString, content: z.string() }) as z.ZodType<WorkspacePluginExportDto>;
export const workspaceProblemDtoSchema = z.object({
  fileId: nonEmptyString,
  path: nonEmptyString,
  revision: nonNegativeInteger,
  severity: z.enum(['info', 'warning', 'error']),
  ruleId: nonEmptyString,
  message: z.string(),
  range: z.object({ start: nonNegativeInteger, end: nonNegativeInteger }).optional(),
  section: z.string().optional(),
}) as z.ZodType<WorkspaceProblemDto>;
export const workspaceProblemsResponseSchema = z.array(workspaceProblemDtoSchema) as z.ZodType<readonly WorkspaceProblemDto[]>;

export const workspaceSearchResultDtoSchema = z.object({
  fileId: nonEmptyString,
  path: nonEmptyString,
  title: z.string(),
  snippet: z.string(),
  score: z.number(),
  section: z.object({ title: z.string(), range: z.object({ start: nonNegativeInteger, end: nonNegativeInteger }) }).optional(),
}) as z.ZodType<WorkspaceSearchResultDto>;
export const workspaceSearchResponseSchema = z.array(workspaceSearchResultDtoSchema) as z.ZodType<
  readonly WorkspaceSearchResultDto[]
>;

export const workspaceBacklinksRequestSchema = z.object({ fileId: nonEmptyString }) as z.ZodType<WorkspaceBacklinksRequest>;
export const workspaceBacklinkDtoSchema = z.object({
  fileId: nonEmptyString,
  path: nonEmptyString,
  label: z.string(),
  range: z.object({ start: nonNegativeInteger, end: nonNegativeInteger }),
}) as z.ZodType<WorkspaceBacklinkDto>;
export const workspaceBacklinksResponseSchema = z.array(workspaceBacklinkDtoSchema) as z.ZodType<
  readonly WorkspaceBacklinkDto[]
>;

export const workspaceReferencesRequestSchema = z.object({ fileId: nonEmptyString }) as z.ZodType<WorkspaceReferencesRequest>;
export const workspaceReferenceDtoSchema = z.object({
  id: nonEmptyString,
  type: z.string(),
  formatted: z.string(),
  sourceLabel: z.string(),
  sourceUri: z.string().optional(),
  sourceFileId: nonEmptyString.optional(),
}) as z.ZodType<WorkspaceReferenceDto>;
export const workspaceReferencesResponseSchema = z.array(workspaceReferenceDtoSchema) as z.ZodType<
  readonly WorkspaceReferenceDto[]
>;

export const workspaceGraphRequestSchema = z.object({
  includePeople: z.boolean().optional(),
  includeTags: z.boolean().optional(),
  focusFileId: nonEmptyString.optional(),
  depth: z.union([z.literal(1), z.literal(2)]).optional(),
}) as z.ZodType<WorkspaceGraphRequest>;
export const workspaceGraphNodeDtoSchema = z.object({
  id: nonEmptyString,
  kind: z.enum(['document', 'reference', 'resource', 'person', 'organization', 'tag']),
  label: z.string(),
  fileId: nonEmptyString.optional(),
  path: nonEmptyString.optional(),
  referenceId: nonEmptyString.optional(),
  resolved: z.boolean().optional(),
  identityState: z.enum(['resolved', 'possible-match', 'ambiguous']).optional(),
}) as z.ZodType<WorkspaceGraphNodeDto>;
export const workspaceGraphEdgeDtoSchema = z.object({
  kind: z.enum(['links-to', 'cites', 'embeds', 'authored-by', 'tagged-with']),
  from: nonEmptyString,
  to: nonEmptyString,
  sourceFileId: nonEmptyString.optional(),
}) as z.ZodType<WorkspaceGraphEdgeDto>;
export const workspaceGraphResponseSchema = z.object({
  nodes: z.array(workspaceGraphNodeDtoSchema),
  edges: z.array(workspaceGraphEdgeDtoSchema),
}) as z.ZodType<WorkspaceGraphDto>;
export const workspaceHistoryRequestSchema = z.object({ fileId: nonEmptyString }) as z.ZodType<WorkspaceHistoryRequest>;
export const workspaceHistorySnapshotRequestSchema = z.object({ fileId: nonEmptyString, label: z.string().max(200).optional() }) as z.ZodType<WorkspaceHistorySnapshotRequest>;
export const workspaceHistoryReadRequestSchema = z.object({ fileId: nonEmptyString, revisionId: nonEmptyString }) as z.ZodType<WorkspaceHistoryReadRequest>;
export const workspaceHistoryDiffRequestSchema = z.object({ fileId: nonEmptyString, fromRevisionId: nonEmptyString, toRevisionId: nonEmptyString.optional() }) as z.ZodType<WorkspaceHistoryDiffRequest>;
export const workspaceHistoryRevisionSchema = z.object({ id: nonEmptyString, source: z.enum(['git', 'snapshot']), label: z.string(), createdAt: z.number().int().nonnegative() });
export const workspaceHistoryResponseSchema = z.object({ gitAvailable: z.boolean(), revisions: z.array(workspaceHistoryRevisionSchema) }) as z.ZodType<WorkspaceHistoryDto>;
export const workspaceHistoryDiffResponseSchema = z.object({ lines: z.array(z.object({ kind: z.enum(['equal', 'added', 'removed']), leftLine: nonNegativeInteger.optional(), rightLine: nonNegativeInteger.optional(), text: z.string() })) }) as z.ZodType<WorkspaceHistoryDiffDto>;
export const workspaceHistoryStructuralDiffResponseSchema = z.object({ changes: z.array(z.object({ kind: z.string(), description: z.string() })) }) as z.ZodType<WorkspaceHistoryStructuralDiffDto>;
export const workspaceDocumentComparisonRequestSchema = z.object({ leftFileId: nonEmptyString, rightFileId: nonEmptyString }) as z.ZodType<WorkspaceDocumentComparisonRequest>;
export const workspaceDocumentComparisonResponseSchema = z.object({ text: workspaceHistoryDiffResponseSchema, structural: workspaceHistoryStructuralDiffResponseSchema }) as z.ZodType<WorkspaceDocumentComparisonDto>;

export const workspaceCreateLiteratureNoteRequestSchema = z.object({
  referenceId: nonEmptyString,
  activeFileId: nonEmptyString.optional(),
}) as z.ZodType<WorkspaceCreateLiteratureNoteRequest>;
export const workspaceCreateLiteratureNoteResponseSchema = workspaceFileSchema;

export const workspaceCitationExplorerRequestSchema = z.object({}) as z.ZodType<WorkspaceCitationExplorerRequest>;
const citationExplorerLocationDtoSchema = z.object({
  fileId: nonEmptyString,
  path: nonEmptyString,
  sectionTitle: z.string().optional(),
  snippet: z.string().optional(),
  range: z.object({ start: nonNegativeInteger, end: nonNegativeInteger }),
}) as z.ZodType<CitationExplorerLocationDto>;
const citationExplorerEntryDtoSchema = z.object({
  referenceId: nonEmptyString,
  formatted: z.string().optional(),
  count: nonNegativeInteger,
  locations: z.array(citationExplorerLocationDtoSchema),
}) as z.ZodType<CitationExplorerEntryDto>;
export const workspaceCitationExplorerResponseSchema = z.object({
  cited: z.array(citationExplorerEntryDtoSchema),
  uncited: z.array(workspaceReferenceDtoSchema),
}) as z.ZodType<WorkspaceCitationExplorerResponseDto>;

export const workspaceResearchOverviewRequestSchema = z.object({}) as z.ZodType<WorkspaceResearchOverviewRequest>;
const workspaceLiteratureReviewDtoSchema = z.object({
  topic: z.string().optional(),
  method: z.string().optional(),
  sample: z.string().optional(),
  result: z.string().optional(),
}) as z.ZodType<WorkspaceLiteratureReviewDto>;
const workspaceResearchReferenceDtoSchema = z.object({
  referenceId: nonEmptyString,
  title: z.string(),
  authors: z.array(z.string()),
  doi: z.string().optional(),
  citationCount: nonNegativeInteger,
  pdf: workspaceFileSchema.optional(),
  literatureNote: workspaceFileSchema.optional(),
  review: workspaceLiteratureReviewDtoSchema,
}) as z.ZodType<WorkspaceResearchReferenceDto>;
export const workspaceResearchOverviewResponseSchema = z.object({
  references: z.array(workspaceResearchReferenceDtoSchema),
}) as z.ZodType<WorkspaceResearchOverviewDto>;
export const workspaceProjectDashboardRequestSchema = z.object({ fileIds: z.array(nonEmptyString) }) as z.ZodType<WorkspaceProjectDashboardRequest>;
export const workspaceProjectDashboardResponseSchema = z.object({
  documents: z.array(z.object({ fileId: nonEmptyString, path: nonEmptyString, revision: nonNegativeInteger, words: nonNegativeInteger, errors: nonNegativeInteger, warnings: nonNegativeInteger })),
}) as z.ZodType<WorkspaceProjectDashboardDto>;

export const workspaceLibraryListRequestSchema = z.object({}) as z.ZodType<WorkspaceLibraryListRequest>;
export const workspaceLibraryEntryResponseSchema = bibliographyEntrySchema;
export const workspaceLibraryListResponseSchema = z.array(bibliographyEntrySchema) as z.ZodType<
  readonly BibliographicEntityDto[]
>;
export const workspaceLibraryUpsertRequestSchema = z.object({
  entry: bibliographyEntrySchema,
}) as z.ZodType<WorkspaceLibraryUpsertRequest>;
export const workspaceLibraryRemoveRequestSchema = z.object({
  id: nonEmptyString,
}) as z.ZodType<WorkspaceLibraryRemoveRequest>;
export const workspaceLibraryFormatRequestSchema = z.object({
  entry: bibliographyEntrySchema,
}) as z.ZodType<WorkspaceLibraryFormatRequest>;
export const workspaceLibraryFormatResponseSchema = z.string();
export const workspaceLibraryResolveDoiRequestSchema = z.object({
  doi: nonEmptyString,
}) as z.ZodType<WorkspaceLibraryResolveDoiRequest>;
export const workspaceLibraryImportRequestSchema = z.object({
  format: z.enum(['bibtex', 'ris', 'csl-json']),
  content: z.string(),
}) as z.ZodType<WorkspaceLibraryImportRequest>;
export const workspaceLibraryImportResponseSchema = z.object({
  imported: z.array(bibliographyEntrySchema),
  diagnostics: z.array(diagnosticDtoSchema),
}) as z.ZodType<WorkspaceLibraryImportResponseDto>;
export const workspaceLibraryIntakePreviewRequestSchema = z.object({
  format: z.enum(['bibtex', 'ris', 'csl-json']).optional(), content: z.string().optional(), entry: bibliographyEntrySchema.optional(),
}).refine((value) => value.entry !== undefined || (value.format !== undefined && value.content !== undefined), 'Informe uma entrada ou formato e conteúdo.') as z.ZodType<WorkspaceLibraryIntakePreviewRequest>;
export const workspaceLibraryIntakePreviewResponseSchema = z.object({
  imported: z.array(bibliographyEntrySchema), diagnostics: z.array(diagnosticDtoSchema),
  duplicates: z.record(z.string(), z.array(z.object({ leftId: nonEmptyString, rightId: nonEmptyString, score: nonNegativeInteger, reasons: z.array(z.enum(['doi', 'isbn', 'title', 'author-year'])) }))),
}) as z.ZodType<WorkspaceLibraryIntakePreviewDto>;
export const workspaceLibraryDuplicatesRequestSchema = z.object({}) as z.ZodType<WorkspaceLibraryDuplicatesRequest>;
export const workspaceLibraryDuplicatesResponseSchema = z.array(z.object({
  leftId: nonEmptyString, rightId: nonEmptyString, score: nonNegativeInteger,
  reasons: z.array(z.enum(['doi', 'isbn', 'title', 'author-year'])),
})) as z.ZodType<readonly WorkspaceLibraryDuplicateDto[]>;
export const workspaceLibraryMergeRequestSchema = z.object({ canonicalId: nonEmptyString, duplicateId: nonEmptyString, entry: bibliographyEntrySchema }) as z.ZodType<WorkspaceLibraryMergeRequest>;
export const workspaceLibraryMergeResponseSchema = z.object({ entry: bibliographyEntrySchema, changedFiles: z.array(nonEmptyString) }) as z.ZodType<WorkspaceLibraryMergeResponseDto>;
export const workspaceLibraryKeyPreviewRequestSchema = z.object({ id: nonEmptyString, policy: z.enum(['author-year', 'title-year']) }) as z.ZodType<WorkspaceLibraryKeyPreviewRequest>;
export const workspaceLibraryKeyPreviewResponseSchema = z.object({ id: nonEmptyString, suggestion: nonEmptyString, policy: z.enum(['author-year', 'title-year']) }) as z.ZodType<WorkspaceLibraryKeyPreviewDto>;
export const workspaceLibraryRenameKeyRequestSchema = z.object({ id: nonEmptyString, nextId: nonEmptyString }) as z.ZodType<WorkspaceLibraryRenameKeyRequest>;
export const workspaceLibraryRenameKeyResponseSchema = z.object({ entry: bibliographyEntrySchema, changedFiles: z.array(nonEmptyString) }) as z.ZodType<WorkspaceLibraryRenameKeyResponseDto>;
export const workspaceReferenceHealthRequestSchema = z.object({}) as z.ZodType<WorkspaceReferenceHealthRequest>;
export const workspaceReferenceAttachmentsRequestSchema = z.object({}) as z.ZodType<WorkspaceReferenceAttachmentsRequest>;
export const workspaceReferenceAttachmentRequestSchema = z.object({ referenceId: nonEmptyString }) as z.ZodType<WorkspaceReferenceAttachmentRequest>;
export const workspaceAttachReferencePdfRequestSchema = z.object({ referenceId: nonEmptyString, name: nonEmptyString, base64: nonEmptyString }) as z.ZodType<WorkspaceAttachReferencePdfRequest>;
export const workspaceReferenceAttachmentDtoSchema = z.object({ referenceId: nonEmptyString, file: workspaceFileDtoSchema, mediaType: z.literal('application/pdf') }) as z.ZodType<WorkspaceReferenceAttachmentDto>;
export const workspaceReferenceAttachmentsResponseSchema = z.array(workspaceReferenceAttachmentDtoSchema) as z.ZodType<readonly WorkspaceReferenceAttachmentDto[]>;
export const workspaceReferenceAttachmentResponseSchema = workspaceReferenceAttachmentDtoSchema as z.ZodType<WorkspaceReferenceAttachmentDto>;
export const workspaceReferenceAttachmentLocalPathResponseSchema = z.string().optional() as z.ZodType<string | undefined>;
export const workspaceReferencePdfResponseSchema = z.object({
  attachment: workspaceReferenceAttachmentDtoSchema,
  base64: nonEmptyString,
}) as z.ZodType<WorkspaceReferencePdfDto>;
export const workspacePdfAnnotationDtoSchema = z.object({
  id: nonEmptyString,
  referenceId: nonEmptyString,
  page: z.number().int().positive(),
  quote: nonEmptyString,
  comment: z.string().optional(),
  createdAt: nonEmptyString,
  literatureNoteFileId: nonEmptyString.optional(),
}) as z.ZodType<WorkspacePdfAnnotationDto>;
export const workspacePdfAnnotationsResponseSchema = z.array(workspacePdfAnnotationDtoSchema) as z.ZodType<readonly WorkspacePdfAnnotationDto[]>;
export const workspaceCreatePdfAnnotationRequestSchema = z.object({
  referenceId: nonEmptyString,
  page: z.number().int().positive(),
  quote: nonEmptyString,
  comment: z.string().optional(),
}) as z.ZodType<WorkspaceCreatePdfAnnotationRequest>;
export const workspacePdfAnnotationRequestSchema = z.object({
  referenceId: nonEmptyString,
  id: nonEmptyString,
}) as z.ZodType<WorkspacePdfAnnotationRequest>;
export const workspacePdfAnnotationLinkResponseSchema = z.object({
  annotation: workspacePdfAnnotationDtoSchema,
  literatureNote: workspaceFileDtoSchema,
}) as z.ZodType<WorkspacePdfAnnotationLinkDto>;
export const workspaceAssetDtoSchema = z.object({
  file: workspaceFileDtoSchema,
  authoredUri: nonEmptyString,
}) as z.ZodType<WorkspaceAssetDto>;
export const workspaceImportAssetRequestSchema = z.object({
  sourceFileId: nonEmptyString,
  name: nonEmptyString,
  mediaType: nonEmptyString,
  base64: nonEmptyString,
  directory: nonEmptyString.optional(),
}) as z.ZodType<WorkspaceImportAssetRequest>;
export const editorImportAssetRequestSchema = z.object({
  fileId: nonEmptyString,
  directory: nonEmptyString.optional(),
}) as z.ZodType<EditorImportAssetRequest>;
export const workspaceCreateDocumentRequestSchema = z.object({ path: nonEmptyString, content: z.string() }) as z.ZodType<WorkspaceCreateDocumentRequest>;
export const workspaceReferenceHealthResponseSchema = z.object({
  total: nonNegativeInteger,
  cited: nonNegativeInteger,
  unused: nonNegativeInteger,
  missing: z.array(nonEmptyString),
  withoutDoi: nonNegativeInteger,
  audit: z.array(z.object({
    referenceId: nonEmptyString,
    code: z.enum(['invalid-doi', 'invalid-isbn', 'missing-url', 'missing-access-date', 'incomplete-author', 'missing-year', 'possible-duplicate', 'inconsistent-key', 'missing-pdf', 'missing-literature-note']),
    message: z.string(),
  })),
}) as z.ZodType<WorkspaceReferenceHealthDto>;

const languageRangeSchema = z.object({ start: nonNegativeInteger, end: nonNegativeInteger });
const languageQueryRequestSchema = z.object({
  fileId: nonEmptyString,
  offset: nonNegativeInteger,
  expectedRevision: nonNegativeInteger,
  limit: z.number().int().positive().max(100).optional(),
});
export const languageCompletionRequestSchema = languageQueryRequestSchema as z.ZodType<LanguageCompletionRequest>;
export const languageHoverRequestSchema = languageQueryRequestSchema as z.ZodType<LanguageHoverRequest>;
export const languageDefinitionRequestSchema = languageQueryRequestSchema as z.ZodType<LanguageDefinitionRequest>;
export const languageReferencesRequestSchema = languageQueryRequestSchema as z.ZodType<LanguageReferencesRequest>;
export const languageCompletionDtoSchema = z.object({
  range: languageRangeSchema,
  items: z.array(z.object({
    kind: z.enum(['citation', 'document', 'math']),
    label: z.string(),
    detail: z.string().optional(),
    insertText: z.string(),
  })),
}) as z.ZodType<LanguageCompletionDto>;
export const languageCompletionResponseSchema = languageCompletionDtoSchema.optional() as z.ZodType<LanguageCompletionDto | undefined>;
export const languageHoverDtoSchema = z.object({
  range: languageRangeSchema,
  contents: z.array(z.string()),
}) as z.ZodType<LanguageHoverDto>;
export const languageHoverResponseSchema = languageHoverDtoSchema.optional() as z.ZodType<LanguageHoverDto | undefined>;
export const languageLocationDtoSchema = z.object({
  fileId: nonEmptyString,
  path: nonEmptyString,
  range: languageRangeSchema,
}) as z.ZodType<LanguageLocationDto>;
export const languageLocationsResponseSchema = z.array(languageLocationDtoSchema) as z.ZodType<readonly LanguageLocationDto[]>;
export const languageCrossReferenceTargetsRequestSchema = z.object({ fileId: nonEmptyString, expectedRevision: nonNegativeInteger }) as z.ZodType<import('./model.js').LanguageCrossReferenceTargetsRequest>;
export const languageCrossReferenceTargetDtoSchema = z.object({ identifier: nonEmptyString, kind: z.enum(['section', 'figure', 'table', 'equation']), label: z.string(), range: languageRangeSchema }) as z.ZodType<import('./model.js').LanguageCrossReferenceTargetDto>;
export const languageCrossReferenceTargetsResponseSchema = z.array(languageCrossReferenceTargetDtoSchema) as z.ZodType<readonly import('./model.js').LanguageCrossReferenceTargetDto[]>;

export const languageUnlinkedMentionsRequestSchema = z.object({ fileId: nonEmptyString, expectedRevision: nonNegativeInteger }) as z.ZodType<import('./model.js').LanguageUnlinkedMentionsRequest>;
export const languageUnlinkedMentionDtoSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('document'), range: languageRangeSchema, targetFileId: nonEmptyString, targetPath: nonEmptyString, text: z.string() }),
  z.object({ kind: z.literal('reference'), range: languageRangeSchema, referenceId: nonEmptyString, text: z.string() }),
]) as z.ZodType<import('./model.js').LanguageUnlinkedMentionDto>;
export const languageUnlinkedMentionsResponseSchema = z.array(languageUnlinkedMentionDtoSchema) as z.ZodType<
  readonly import('./model.js').LanguageUnlinkedMentionDto[]
>;
export const languageWritingStatisticsRequestSchema = z.object({ fileId: nonEmptyString, expectedRevision: nonNegativeInteger }) as z.ZodType<LanguageWritingStatisticsRequest>;
export const languageWritingStatisticsResponseSchema = z.object({
  words: nonNegativeInteger, characters: nonNegativeInteger, paragraphs: nonNegativeInteger, citations: nonNegativeInteger,
  figures: nonNegativeInteger, tables: nonNegativeInteger, equations: nonNegativeInteger, estimatedReadingMinutes: z.number().int().positive(),
  sections: z.array(z.object({ title: z.string(), words: nonNegativeInteger })),
}) as z.ZodType<LanguageWritingStatisticsDto>;
export const languageRenameRequestSchema = z.object({ fileId: nonEmptyString, offset: nonNegativeInteger, newName: nonEmptyString, expectedRevision: nonNegativeInteger }) as z.ZodType<LanguageRenameRequest>;
export const languageRenameResultSchema = z.object({ label: nonEmptyString, changedFiles: z.array(nonEmptyString) }) as z.ZodType<LanguageRenameResultDto>;
export const languageRenameResponseSchema = languageRenameResultSchema.optional() as z.ZodType<LanguageRenameResultDto | undefined>;
export const languageMoveSectionRequestSchema = z.object({ fileId: nonEmptyString, offset: nonNegativeInteger, direction: z.enum(['up', 'down']), expectedRevision: nonNegativeInteger }) as z.ZodType<LanguageMoveSectionRequest>;

export const workspaceOpenRequestSchema = z.object({
  rootPath: nonEmptyString,
}) as z.ZodType<WorkspaceOpenRequest>;

export const workspaceOpenResponseSchema = z.object({
  workspaceId: nonEmptyString,
  configuration: z.object({
    defaultProfileId: nonEmptyString.optional(),
    ignoredPaths: z.array(nonEmptyString),
  }),
  files: z.array(workspaceFileSchema),
}) as z.ZodType<WorkspaceOpenResponse>;

export const workspaceListResponseSchema = z.array(workspaceFileSchema);
export const emptyResponseSchema = z.undefined();

const editorSelectionSchema = z.object({
  anchor: nonNegativeInteger,
  head: nonNegativeInteger,
});

const editorTextEditSchema = z.object({
  range: z.object({ start: nonNegativeInteger, end: nonNegativeInteger }),
  text: z.string(),
});

const editorTransactionSchema = z
  .object({
    edits: z.array(editorTextEditSchema).optional(),
    selection: editorSelectionSchema.optional(),
  })
  .refine((value) => value.edits !== undefined || value.selection !== undefined, {
    message: 'Uma transação precisa alterar texto ou seleção.',
  });

const editorOutlineItemSchema = z.object({
  nodeId: nonEmptyString,
  title: z.string(),
  depth: z.number().int().positive(),
  role: nonEmptyString.optional(),
  range: z.object({ start: nonNegativeInteger, end: nonNegativeInteger }),
});

export const editorSnapshotDtoSchema = z.object({
  fileId: nonEmptyString,
  version: nonNegativeInteger,
  session: z.object({
    file: workspaceFileSchema,
    revision: nonNegativeInteger,
    content: z.string(),
    contentHash: nonEmptyString.optional(),
    dirty: z.boolean(),
    status: z.enum(['idle', 'compiling', 'failed']),
    diagnostics: z.array(diagnosticDtoSchema),
    externalChange: workspaceFileSchema.optional(),
  }),
  selection: editorSelectionSchema,
  outline: z.array(editorOutlineItemSchema),
  diagnostics: z.array(diagnosticDtoSchema),
  previewRevision: nonNegativeInteger.optional(),
  previewProfileId: nonEmptyString.optional(),
}) as z.ZodType<EditorSnapshotDto>;

export const editorOpenRequestSchema = z.object({ fileId: nonEmptyString }) as z.ZodType<EditorOpenRequest>;
export const editorSnapshotRequestSchema = z.object({ fileId: nonEmptyString }) as z.ZodType<EditorSnapshotRequest>;
export const editorPreviewRequestSchema = z.object({ fileId: nonEmptyString }) as z.ZodType<EditorPreviewRequest>;
export const editorPreviewDtoSchema = z.object({
  fileId: nonEmptyString,
  revision: nonNegativeInteger,
  profileId: nonEmptyString,
  html: z.string(),
}) as z.ZodType<EditorPreviewDto>;
/** A resposta pode legitimamente não ter preview ainda; ver EditorPreviewDto. */
export const editorPreviewResponseSchema = editorPreviewDtoSchema.optional() as z.ZodType<EditorPreviewDto | undefined>;
export const editorExportRequestSchema = z.object({ fileId: nonEmptyString }) as z.ZodType<EditorExportRequest>;
export const editorExportDtoSchema = z.object({
  fileId: nonEmptyString,
  revision: nonNegativeInteger,
  publication: publicationDocumentDtoSchema,
}) as z.ZodType<EditorExportDto>;
/** A resposta pode legitimamente não ter compilação ainda; ver EditorExportDto. */
export const editorExportResponseSchema = editorExportDtoSchema.optional() as z.ZodType<EditorExportDto | undefined>;

export const editorExportResultDtoSchema = z.object({
  path: nonEmptyString,
  pages: z.number().int().nonnegative().optional(),
}) as z.ZodType<EditorExportResultDto>;

export const exportFormatSchema = z.enum(['pdf', 'docx']) as z.ZodType<ExportFormat>;
export const desktopExportRequestSchema = z.object({
  fileId: nonEmptyString,
  format: exportFormatSchema,
}) as z.ZodType<DesktopExportRequest>;
export const exportRequestSchema = z.object({
  publication: publicationDocumentDtoSchema,
  format: exportFormatSchema,
}) as z.ZodType<ExportRequest>;
export const exportResultDtoSchema = z.object({
  bytes: z.instanceof(Uint8Array),
  pages: z.number().int().nonnegative().optional(),
}) as z.ZodType<ExportResultDto>;
export const editorDispatchRequestSchema = z.object({
  fileId: nonEmptyString,
  expectedRevision: nonNegativeInteger,
  transaction: editorTransactionSchema,
}) as z.ZodType<EditorDispatchRequest>;
export const editorSaveRequestSchema = z.object({
  fileId: nonEmptyString,
  expectedRevision: nonNegativeInteger,
}) as z.ZodType<EditorSaveRequest>;
export const editorCloseRequestSchema = z.object({ fileId: nonEmptyString }) as z.ZodType<EditorCloseRequest>;
export const editorResolveConflictRequestSchema = z.object({
  fileId: nonEmptyString,
  resolution: z.enum(['keep-local', 'reload-external']),
}) as z.ZodType<EditorResolveConflictRequest>;

export const workspaceEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('workspace:file-created'), file: workspaceFileSchema }),
  z.object({ type: z.literal('workspace:file-changed'), file: workspaceFileSchema }),
  z.object({
    type: z.literal('workspace:file-renamed'),
    file: workspaceFileSchema,
    previousPath: nonEmptyString,
  }),
  z.object({
    type: z.literal('workspace:file-removed'),
    fileId: nonEmptyString,
    path: nonEmptyString,
  }),
]) as z.ZodType<WorkspaceEvent>;

export const desktopEventDtoSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('desktop:editor-updated'), snapshot: editorSnapshotDtoSchema }),
  z.object({ type: z.literal('desktop:editor-closed'), fileId: nonEmptyString }),
  z.object({ type: z.literal('desktop:workspace-event'), event: workspaceEventSchema }),
  z.object({ type: z.literal('desktop:operational-error'), operation: nonEmptyString, error: protocolErrorSchema }),
]) as z.ZodType<DesktopEventDto>;

const problemasDeZod = (issues: readonly z.core.$ZodIssue[]): readonly ProtocolProblem[] =>
  issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join('.') : '(raiz)',
    message: issue.message,
  }));

/**
 * Superfície mínima de schema usada para validar DTOs.
 *
 * Não troque por `z.ZodType<T>`. Inferir `T` a partir de `z.ZodType<T>` obriga o
 * compilador a instanciar os internals do Zod 4 sobre a forma inteira do DTO; nos
 * schemas grandes do editor isso passava de 30 milhões de instanciações e estourava
 * a heap do `tsc` (`pnpm typecheck` morria com exit 134). Aqui `T` aparece em um
 * único campo, então a inferência é rasa. Ver docs/adr/0014.
 */
export interface DtoSchema<T> {
  safeParse(
    value: unknown,
  ):
    | { readonly success: true; readonly data: T }
    | { readonly success: false; readonly error: { readonly issues: readonly z.core.$ZodIssue[] } };
}

export function validarDto<T>(schema: DtoSchema<T>, value: unknown): ProtocolResult<T> {
  const parsed = schema.safeParse(value);
  if (parsed.success) return protocolOk(parsed.data);
  return protocolError('VALIDATION', 'Mensagem fora do contrato do protocolo.', problemasDeZod(parsed.error.issues));
}

export const validarCompilerPrepareRequest = (value: unknown): ProtocolResult<CompilerPrepareRequest> =>
  validarDto(compilerPrepareRequestSchema, value);

export const validarCompilerCompileRequest = (value: unknown): ProtocolResult<CompilerCompileRequest> =>
  validarDto(compilerCompileRequestSchema, value);

export const validarPreparedCompilationDto = (value: unknown): ProtocolResult<PreparedCompilationDto> =>
  validarDto(preparedCompilationDtoSchema, value);

export const validarCompilationResultDto = (value: unknown): ProtocolResult<CompilationResultDto> =>
  validarDto(compilationResultDtoSchema, value);

export const validarWorkspaceOpenRequest = (value: unknown): ProtocolResult<WorkspaceOpenRequest> =>
  validarDto(workspaceOpenRequestSchema, value);

export const validarWorkspaceOpenResponse = (value: unknown): ProtocolResult<WorkspaceOpenResponse> =>
  validarDto(workspaceOpenResponseSchema, value);

export const validarEditorSnapshotDto = (value: unknown): ProtocolResult<EditorSnapshotDto> =>
  validarDto(editorSnapshotDtoSchema, value);

export const validarEditorOpenRequest = (value: unknown): ProtocolResult<EditorOpenRequest> =>
  validarDto(editorOpenRequestSchema, value);

export const validarEditorSnapshotRequest = (value: unknown): ProtocolResult<EditorSnapshotRequest> =>
  validarDto(editorSnapshotRequestSchema, value);

export const validarEditorPreviewRequest = (value: unknown): ProtocolResult<EditorPreviewRequest> =>
  validarDto(editorPreviewRequestSchema, value);

export const validarEditorExportRequest = (value: unknown): ProtocolResult<EditorExportRequest> =>
  validarDto(editorExportRequestSchema, value);

export const validarDesktopExportRequest = (value: unknown): ProtocolResult<DesktopExportRequest> =>
  validarDto(desktopExportRequestSchema, value);

export const validarWorkspaceSearchRequest = (value: unknown): ProtocolResult<WorkspaceSearchRequest> =>
  validarDto(workspaceSearchRequestSchema, value);
export const validarWorkspaceProblemsRequest = (value: unknown): ProtocolResult<WorkspaceProblemsRequest> =>
  validarDto(workspaceProblemsRequestSchema, value);
export const validarWorkspaceProfileValidationPreviewRequest = (value: unknown): ProtocolResult<WorkspaceProfileValidationPreviewRequest> =>
  validarDto(workspaceProfileValidationPreviewRequestSchema, value);
export const validarWorkspacePluginSetEnabledRequest = (value: unknown): ProtocolResult<WorkspacePluginSetEnabledRequest> => validarDto(workspacePluginSetEnabledRequestSchema, value);
export const validarWorkspacePluginCommandRequest = (value: unknown): ProtocolResult<WorkspacePluginCommandRequest> => validarDto(workspacePluginCommandRequestSchema, value);
export const validarDesktopPluginExportRequest = (value: unknown): ProtocolResult<DesktopPluginExportRequest> => validarDto(desktopPluginExportRequestSchema, value);

export const validarWorkspaceBacklinksRequest = (value: unknown): ProtocolResult<WorkspaceBacklinksRequest> =>
  validarDto(workspaceBacklinksRequestSchema, value);

export const validarWorkspaceReferencesRequest = (value: unknown): ProtocolResult<WorkspaceReferencesRequest> =>
  validarDto(workspaceReferencesRequestSchema, value);

export const validarWorkspaceGraphRequest = (value: unknown): ProtocolResult<WorkspaceGraphRequest> =>
  validarDto(workspaceGraphRequestSchema, value);
export const validarWorkspaceHistoryRequest = (value: unknown): ProtocolResult<WorkspaceHistoryRequest> => validarDto(workspaceHistoryRequestSchema, value);
export const validarWorkspaceHistorySnapshotRequest = (value: unknown): ProtocolResult<WorkspaceHistorySnapshotRequest> => validarDto(workspaceHistorySnapshotRequestSchema, value);
export const validarWorkspaceHistoryDiffRequest = (value: unknown): ProtocolResult<WorkspaceHistoryDiffRequest> => validarDto(workspaceHistoryDiffRequestSchema, value);
export const validarWorkspaceDocumentComparisonRequest = (value: unknown): ProtocolResult<WorkspaceDocumentComparisonRequest> => validarDto(workspaceDocumentComparisonRequestSchema, value);

export const validarWorkspaceCreateLiteratureNoteRequest = (
  value: unknown,
): ProtocolResult<WorkspaceCreateLiteratureNoteRequest> => validarDto(workspaceCreateLiteratureNoteRequestSchema, value);

export const validarWorkspaceCitationExplorerRequest = (
  value: unknown,
): ProtocolResult<WorkspaceCitationExplorerRequest> => validarDto(workspaceCitationExplorerRequestSchema, value);

export const validarWorkspaceResearchOverviewRequest = (
  value: unknown,
): ProtocolResult<WorkspaceResearchOverviewRequest> => validarDto(workspaceResearchOverviewRequestSchema, value);
export const validarWorkspaceProjectDashboardRequest = (value: unknown): ProtocolResult<WorkspaceProjectDashboardRequest> =>
  validarDto(workspaceProjectDashboardRequestSchema, value);

export const validarWorkspaceLibraryListRequest = (value: unknown): ProtocolResult<WorkspaceLibraryListRequest> =>
  validarDto(workspaceLibraryListRequestSchema, value);
export const validarWorkspaceLibraryUpsertRequest = (value: unknown): ProtocolResult<WorkspaceLibraryUpsertRequest> =>
  validarDto(workspaceLibraryUpsertRequestSchema, value);
export const validarWorkspaceLibraryRemoveRequest = (value: unknown): ProtocolResult<WorkspaceLibraryRemoveRequest> =>
  validarDto(workspaceLibraryRemoveRequestSchema, value);
export const validarWorkspaceLibraryDuplicatesRequest = (value: unknown): ProtocolResult<WorkspaceLibraryDuplicatesRequest> => validarDto(workspaceLibraryDuplicatesRequestSchema, value);
export const validarWorkspaceLibraryMergeRequest = (value: unknown): ProtocolResult<WorkspaceLibraryMergeRequest> => validarDto(workspaceLibraryMergeRequestSchema, value);
export const validarWorkspaceLibraryKeyPreviewRequest = (value: unknown): ProtocolResult<WorkspaceLibraryKeyPreviewRequest> => validarDto(workspaceLibraryKeyPreviewRequestSchema, value);
export const validarWorkspaceLibraryRenameKeyRequest = (value: unknown): ProtocolResult<WorkspaceLibraryRenameKeyRequest> => validarDto(workspaceLibraryRenameKeyRequestSchema, value);
export const validarWorkspaceLibraryFormatRequest = (value: unknown): ProtocolResult<WorkspaceLibraryFormatRequest> =>
  validarDto(workspaceLibraryFormatRequestSchema, value);
export const validarWorkspaceLibraryResolveDoiRequest = (value: unknown): ProtocolResult<WorkspaceLibraryResolveDoiRequest> =>
  validarDto(workspaceLibraryResolveDoiRequestSchema, value);
export const validarWorkspaceLibraryImportRequest = (value: unknown): ProtocolResult<WorkspaceLibraryImportRequest> =>
  validarDto(workspaceLibraryImportRequestSchema, value);
export const validarWorkspaceLibraryIntakePreviewRequest = (value: unknown): ProtocolResult<WorkspaceLibraryIntakePreviewRequest> =>
  validarDto(workspaceLibraryIntakePreviewRequestSchema, value);
export const validarWorkspaceReferenceHealthRequest = (value: unknown): ProtocolResult<WorkspaceReferenceHealthRequest> =>
  validarDto(workspaceReferenceHealthRequestSchema, value);
export const validarWorkspaceReferenceAttachmentsRequest = (value: unknown): ProtocolResult<WorkspaceReferenceAttachmentsRequest> => validarDto(workspaceReferenceAttachmentsRequestSchema, value);
export const validarWorkspaceReferenceAttachmentRequest = (value: unknown): ProtocolResult<WorkspaceReferenceAttachmentRequest> => validarDto(workspaceReferenceAttachmentRequestSchema, value);
export const validarWorkspaceAttachReferencePdfRequest = (value: unknown): ProtocolResult<WorkspaceAttachReferencePdfRequest> => validarDto(workspaceAttachReferencePdfRequestSchema, value);
export const validarWorkspaceCreatePdfAnnotationRequest = (value: unknown): ProtocolResult<WorkspaceCreatePdfAnnotationRequest> => validarDto(workspaceCreatePdfAnnotationRequestSchema, value);
export const validarWorkspacePdfAnnotationRequest = (value: unknown): ProtocolResult<WorkspacePdfAnnotationRequest> => validarDto(workspacePdfAnnotationRequestSchema, value);
export const validarWorkspaceImportAssetRequest = (value: unknown): ProtocolResult<WorkspaceImportAssetRequest> =>
  validarDto(workspaceImportAssetRequestSchema, value);
export const validarEditorImportAssetRequest = (value: unknown): ProtocolResult<EditorImportAssetRequest> =>
  validarDto(editorImportAssetRequestSchema, value);
export const validarWorkspaceCreateDocumentRequest = (value: unknown): ProtocolResult<WorkspaceCreateDocumentRequest> => validarDto(workspaceCreateDocumentRequestSchema, value);
export const validarWorkspaceRenameRequest = (value: unknown): ProtocolResult<WorkspaceRenameRequest> => validarDto(workspaceRenameRequestSchema, value);

export const validarLanguageCompletionRequest = (value: unknown): ProtocolResult<LanguageCompletionRequest> =>
  validarDto(languageCompletionRequestSchema, value);
export const validarLanguageHoverRequest = (value: unknown): ProtocolResult<LanguageHoverRequest> =>
  validarDto(languageHoverRequestSchema, value);
export const validarLanguageDefinitionRequest = (value: unknown): ProtocolResult<LanguageDefinitionRequest> =>
  validarDto(languageDefinitionRequestSchema, value);
export const validarLanguageReferencesRequest = (value: unknown): ProtocolResult<LanguageReferencesRequest> =>
  validarDto(languageReferencesRequestSchema, value);
export const validarLanguageCrossReferenceTargetsRequest = (value: unknown): ProtocolResult<import('./model.js').LanguageCrossReferenceTargetsRequest> =>
  validarDto(languageCrossReferenceTargetsRequestSchema, value);
export const validarLanguageUnlinkedMentionsRequest = (value: unknown): ProtocolResult<import('./model.js').LanguageUnlinkedMentionsRequest> =>
  validarDto(languageUnlinkedMentionsRequestSchema, value);
export const validarLanguageWritingStatisticsRequest = (value: unknown): ProtocolResult<LanguageWritingStatisticsRequest> => validarDto(languageWritingStatisticsRequestSchema, value);
export const validarLanguageRenameRequest = (value: unknown): ProtocolResult<LanguageRenameRequest> => validarDto(languageRenameRequestSchema, value);
export const validarLanguageMoveSectionRequest = (value: unknown): ProtocolResult<LanguageMoveSectionRequest> => validarDto(languageMoveSectionRequestSchema, value);

export const validarEditorDispatchRequest = (value: unknown): ProtocolResult<EditorDispatchRequest> =>
  validarDto(editorDispatchRequestSchema, value);

export const validarEditorSaveRequest = (value: unknown): ProtocolResult<EditorSaveRequest> =>
  validarDto(editorSaveRequestSchema, value);

export const validarEditorCloseRequest = (value: unknown): ProtocolResult<EditorCloseRequest> =>
  validarDto(editorCloseRequestSchema, value);
export const validarEditorResolveConflictRequest = (value: unknown): ProtocolResult<EditorResolveConflictRequest> =>
  validarDto(editorResolveConflictRequestSchema, value);

export const validarDesktopEventDto = (value: unknown): ProtocolResult<DesktopEventDto> =>
  validarDto(desktopEventDtoSchema, value);

export const validarSystemInformationDto = (value: unknown): ProtocolResult<SystemInformationDto> =>
  validarDto(systemInformationDtoSchema, value);

/**
 * O envelope é estático de propósito: compor `schema` dentro de um `z.union` por
 * chamada instanciava os internals do Zod sobre o DTO inteiro a cada call site.
 * Validamos a casca primeiro e o payload depois, com o mesmo resultado.
 */
const resultadoEnvelopeSchema = z.union([
  z.object({ ok: z.literal(true), value: z.unknown() }),
  z.object({ ok: z.literal(false), error: protocolErrorSchema }),
]);

/** Valida também o envelope de sucesso/erro devolvido por um serviço remoto. */
export function validarResultadoDoProtocolo<T>(
  value: unknown,
  schema: DtoSchema<T>,
): ProtocolResult<ProtocolResult<T>> {
  const envelope = resultadoEnvelopeSchema.safeParse(value);
  if (!envelope.success) {
    return protocolError(
      'VALIDATION',
      'Resposta fora do contrato do protocolo.',
      problemasDeZod(envelope.error.issues),
    );
  }
  if (!envelope.data.ok) return protocolOk(envelope.data as ProtocolResult<T>);
  const payload = schema.safeParse(envelope.data.value);
  if (!payload.success) {
    return protocolError(
      'VALIDATION',
      'Resposta fora do contrato do protocolo.',
      problemasDeZod(payload.error.issues).map((problem) => ({
        ...problem,
        path: problem.path === '(raiz)' ? 'value' : `value.${problem.path}`,
      })),
    );
  }
  return protocolOk(protocolOk(payload.data));
}

/** Recusa mensagens futuras de forma explícita, sem tentar interpretá-las. */
export const validarVersaoDoProtocolo = (version: number): ProtocolResult<typeof PROTOCOL_VERSION> =>
  version === PROTOCOL_VERSION
    ? protocolOk(PROTOCOL_VERSION)
    : protocolError(
        'UNSUPPORTED_VERSION',
        `Versão de protocolo ${version} não suportada; esta build aceita ${PROTOCOL_VERSION}.`,
      );
