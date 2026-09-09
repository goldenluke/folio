import type {
  BibliographicEntity,
  Diagnostic,
  DocumentAst,
  DocumentId,
  Registry,
  ResourceId,
} from '@abnt/document-model';
import type { PagePolicy, PublicationDocument, PublicationProfile } from '@abnt/publication';
import type { ResolvedDocument } from '@abnt/semantics';
import type { RelatorioDeValidacao } from '@abnt/standards';

declare const contentHashBrand: unique symbol;

/** Hash de conteúdo calculado pelo host que possui acesso ao armazenamento. */
export type ContentHash = string & { readonly [contentHashBrand]: 'ContentHash' };

export const asContentHash = (value: string): ContentHash => value as ContentHash;

/** Snapshot imutável da fonte em uma revisão conhecida pelo host. */
export interface SourceSnapshot {
  readonly documentId: DocumentId;
  readonly revision: number;
  readonly content: string;
  readonly contentHash: ContentHash;
}

/** Dependências declaradas pelo autor, antes de qualquer acesso ao ambiente. */
export interface AuthoredDependencies {
  readonly bibliographyUris: readonly string[];
  readonly resources: readonly {
    readonly resourceId: ResourceId;
    readonly authoredUri: string;
  }[];
}

export interface PreparedCompilation {
  readonly source: SourceSnapshot;
  readonly document: DocumentAst;
  readonly dependencies: AuthoredDependencies;
  readonly diagnostics: readonly Diagnostic[];
}

export type BibliographySourceFormat = 'bibtex' | 'csl-json' | 'ris' | 'memory' | 'remote';

/** Origem auditável de um conjunto de referências carregado pelo host. */
export interface BibliographySource {
  readonly id: string;
  readonly authoredUri?: string;
  readonly resolvedUri?: string;
  readonly format: BibliographySourceFormat;
  readonly contentHash?: ContentHash;
}

export interface BibliographyProvenance {
  readonly sourceId: string;
  readonly sourceUri?: string;
}

/** Bibliografia efetiva, separada do registry autoral da Document AST. */
export interface BibliographyEnvironment {
  readonly entries: Registry<BibliographicEntity>;
  readonly sources: readonly BibliographySource[];
  readonly provenanceByReference: Registry<readonly BibliographyProvenance[]>;
}

/** Resultado de resolver um recurso contra o ambiente do host. */
export interface ResourceResolution {
  readonly resourceId: ResourceId;
  readonly authoredUri: string;
  readonly status: 'resolved' | 'external' | 'missing' | 'blocked';
  readonly resolvedUri?: string;
  readonly mediaType?: string;
  readonly contentHash?: ContentHash;
}

export interface DependencySnapshot {
  readonly bibliography: readonly BibliographySource[];
  readonly resources: readonly ResourceResolution[];
}

/** Configuração ambiental, nunca uma decisão editorial do documento. */
export interface CompilationConfiguration {
  readonly defaultProfileId?: string;
}

/** Dados externos puros e serializáveis que complementam a autoria. */
export interface CompilationEnvironment {
  readonly bibliography: BibliographyEnvironment;
  readonly resources: Registry<ResourceResolution>;
  readonly dependencies: DependencySnapshot;
  readonly configuration?: CompilationConfiguration;
}

/** O host prepara o ambiente e mantém diagnósticos fora da AST. */
export interface EnvironmentPreparation {
  readonly environment: CompilationEnvironment;
  readonly diagnostics: readonly Diagnostic[];
}

export interface CompilationUnit {
  readonly document: DocumentAst;
  readonly environment: CompilationEnvironment;
}

export interface CompilationProfileDefinition {
  readonly profile: PublicationProfile;
  validar(document: ResolvedDocument): RelatorioDeValidacao;
  /** Metadados declarativos para hosts/UI; nunca contém implementação normativa. */
  readonly manifest: PublicationProfileManifest;
}

export type PublicationProfileCapability =
  | 'abstract' | 'keywords' | 'numbered-sections' | 'figures' | 'tables'
  | 'equations' | 'bibliography' | 'toc' | 'lists' | 'pretextual' | 'posttextual';

export interface PublicationProfileRuleManifest {
  readonly id: string;
  readonly standard?: string;
  readonly description: string;
}

/** Metadata de produto, distinta da implementação `PublicationProfile`. */
export interface PublicationProfileManifest {
  readonly id: string;
  readonly version: string;
  readonly name: string;
  readonly description?: string;
  readonly documentKinds: readonly string[];
  readonly citationSystem?: string;
  readonly capabilities: readonly PublicationProfileCapability[];
  readonly requiredMetadata: readonly string[];
  readonly optionalMetadata: readonly string[];
  readonly rules: readonly PublicationProfileRuleManifest[];
  readonly pagePolicy: PagePolicy;
  readonly composition?: { readonly baseProfileId: string; readonly overrides: readonly string[] };
}

/** Composição declarada; não há subclasses de profiles institucionais. */
export interface InstitutionalProfileComposition {
  readonly id: string;
  readonly version: string;
  readonly name: string;
  readonly description: string;
  readonly baseProfileId: string;
  readonly margin?: Partial<PagePolicy['margin']>;
  readonly requiredMetadata?: readonly string[];
}

export interface CompilationProfileRegistry {
  readonly defaultProfileId: string;
  readonly profiles: Readonly<Record<string, CompilationProfileDefinition>>;
}

export interface CompilationRequest {
  readonly prepared: PreparedCompilation;
  readonly environment: EnvironmentPreparation;
  readonly profileId?: string;
}

/** Saída semântica e editorial; HTML/PDF pertencem ao host/exportador. */
export interface CompilationResult {
  readonly unit: CompilationUnit;
  readonly documentId: DocumentId;
  readonly revision: number;
  readonly contentHash: ContentHash;
  readonly profileId: string;
  readonly ast: DocumentAst;
  readonly resolved: ResolvedDocument;
  readonly validation: RelatorioDeValidacao;
  readonly publication: PublicationDocument;
  readonly diagnostics: readonly Diagnostic[];
}

export interface HeadlessCompiler {
  prepare(source: SourceSnapshot, signal?: AbortSignal): Promise<PreparedCompilation>;
  compile(request: CompilationRequest, signal?: AbortSignal): Promise<CompilationResult>;
}
