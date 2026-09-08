import type {
  AuthoredDependenciesDto,
  BibliographyEnvironmentDto,
  CompilerService,
  CompilationResultDto,
  DiagnosticDto,
  EnvironmentPreparationDto,
  PreparedCompilationDto,
  ProtocolError,
  ProtocolResult,
  SourceSnapshotDto,
} from '@abnt/protocol';
import type { CompositeSourceMap } from '@abnt/source-composition';
import type {
  WorkspaceConfiguration,
  WorkspaceFile,
  WorkspaceFileId,
  WorkspaceStorage,
} from '@abnt/workspace-core';

/** Identidade da sessão: o FileId sobrevive a rename e a reinicializações. */
export type DocumentSessionId = WorkspaceFileId;

/**
 * A revisão da sessão é independente da revisão persistida do arquivo.
 * Cada edição do rascunho a incrementa; salvar só avança a revisão do workspace.
 */
export type DocumentSessionRevision = number;

export type DocumentSessionStatus = 'idle' | 'compiling' | 'failed';

export interface DocumentSessionPreview {
  readonly profileId: string;
  /**
   * Revisão para a qual esta Publication AST foi compilada — não a revisão
   * atual da sessão. As duas divergem sempre que uma edição chega enquanto a
   * compilação anterior ainda está em voo: `preview` só é sobrescrito quando a
   * nova compilação termina, então um consumidor que comparasse contra
   * `session.revision` veria o preview como "atual" antes de realmente ser.
   */
  readonly revision: DocumentSessionRevision;
  readonly publication: CompilationResultDto['publication'];
}

/** Snapshot imutável consumido por UI, preview ou language service. */
export interface DocumentSessionSnapshot {
  readonly id: DocumentSessionId;
  readonly file: WorkspaceFile;
  readonly revision: DocumentSessionRevision;
  readonly content: string;
  /** Ausente após edição até o host calcular o fingerprint do novo rascunho. */
  readonly contentHash?: string;
  readonly dirty: boolean;
  readonly status: DocumentSessionStatus;
  readonly dependencies?: AuthoredDependenciesDto;
  readonly diagnostics: readonly DiagnosticDto[];
  readonly preview?: DocumentSessionPreview;
  /**
   * Bibliografia resolvida na última compilação bem-sucedida do ambiente —
   * sobrevive a edições seguintes até uma nova resolução terminar. Diferente
   * de `preview`, não é invalidada a cada tecla: referências raramente mudam
   * por edição de prosa, e apagar o painel a cada keystroke seria pior UX que
   * mostrar um catálogo com poucos instantes de atraso.
   */
  readonly bibliography?: BibliographyEnvironmentDto;
  /** Alteração externa preservada enquanto existe um rascunho local não salvo. */
  readonly externalChange?: WorkspaceFile;
}

export type DocumentSessionChangeOrigin = 'open' | 'edit' | 'save' | 'workspace';

/** Eventos semanticamente estáveis; o renderer não precisa observar fs nem o compiler. */
export type DocumentSessionEvent =
  | {
      readonly type: 'session:opened';
      readonly session: DocumentSessionSnapshot;
    }
  | {
      readonly type: 'session:changed';
      readonly origin: DocumentSessionChangeOrigin;
      readonly session: DocumentSessionSnapshot;
    }
  | {
      readonly type: 'session:compilation-started';
      readonly session: DocumentSessionSnapshot;
    }
  | {
      readonly type: 'session:dependencies-resolved';
      readonly sessionId: DocumentSessionId;
      readonly revision: DocumentSessionRevision;
      readonly dependencies: AuthoredDependenciesDto;
    }
  | {
      readonly type: 'session:diagnostics-updated';
      readonly sessionId: DocumentSessionId;
      readonly revision: DocumentSessionRevision;
      readonly diagnostics: readonly DiagnosticDto[];
    }
  | {
      readonly type: 'session:preview-updated';
      readonly sessionId: DocumentSessionId;
      readonly revision: DocumentSessionRevision;
      readonly preview: DocumentSessionPreview;
    }
  | {
      readonly type: 'session:compilation-discarded';
      readonly sessionId: DocumentSessionId;
      readonly revision: DocumentSessionRevision;
      readonly reason: 'cancelled' | 'stale';
    }
  | {
      readonly type: 'session:compilation-failed';
      readonly session: DocumentSessionSnapshot;
      readonly error: ProtocolError;
    }
  | {
      readonly type: 'session:external-conflict';
      readonly session: DocumentSessionSnapshot;
      readonly externalFile: WorkspaceFile;
    }
  | {
      readonly type: 'session:closed';
      readonly sessionId: DocumentSessionId;
      readonly reason: 'explicit' | 'removed';
    };

export type DocumentSessionEventListener = (event: DocumentSessionEvent) => void;

/** O host escolhe o hash (Web Crypto, Node crypto, WASM); a sessão não importa Node. */
export type SessionContentHasher = (
  content: string,
  signal?: AbortSignal,
) => Promise<string> | string;

/** Dados que o host precisa para materializar bibliografia, recursos e perfil padrão. */
export interface CompilationEnvironmentRequest {
  readonly file: WorkspaceFile;
  readonly source: SourceSnapshotDto;
  readonly prepared: PreparedCompilationDto;
  readonly workspaceConfiguration: WorkspaceConfiguration;
}

/** Fonte virtual usada somente pelo pipeline de compilação; o rascunho segue autoral. */
export interface CompilationSourceExpansion {
  readonly content: string;
  readonly diagnostics: readonly DiagnosticDto[];
  /**
   * F66 — presente quando o host compôs `content` a partir de mais de um
   * arquivo (embeds). Ausente para hosts sem transclusão (testes/embedding
   * mínimos), nunca um mapa vazio fingindo cobertura.
   */
  readonly sourceMap?: CompositeSourceMap;
}

export interface CompilationSourceExpansionRequest {
  readonly file: WorkspaceFile;
  readonly content: string;
}

/**
 * Porta para o ambiente externo. Ela é deliberadamente separada do compiler:
 * a sessão descobre dependências, o host decide como e onde resolvê-las.
 */
export interface CompilationEnvironmentResolver {
  /**
   * F60–F62: host expande transclusões antes de enviar a fonte ao compiler.
   * Opcional para manter hosts sem vault (testes/embedding) estritamente
   * autorais, sem um resolvedor artificial.
   */
  expandSource?(
    request: CompilationSourceExpansionRequest,
    signal?: AbortSignal,
  ): Promise<CompilationSourceExpansion>;
  /**
   * F67 — diagnósticos do compiler carregam offsets da fonte virtual quando
   * `expandSource` compôs `content`. Este método traduz `documentId`/offset
   * de volta ao arquivo autoral real via o `CompositeSourceMap` da mesma
   * expansão. Só o host de composição (workspace-environment) sabe fazer essa
   * tradução; a sessão só decide QUANDO chamar, nunca COMO. Diagnósticos sem
   * origem autoral única (`synthetic`) voltam inalterados — nunca inventa uma.
   */
  remapCompositionDiagnostics?(
    diagnostics: readonly DiagnosticDto[],
    sourceMap: CompositeSourceMap,
    rootDocumentId: string,
  ): readonly DiagnosticDto[];
  resolve(
    request: CompilationEnvironmentRequest,
    signal?: AbortSignal,
  ): Promise<ProtocolResult<EnvironmentPreparationDto>>;
}

export interface DocumentSessionsOptions {
  readonly storage: WorkspaceStorage;
  readonly compiler: CompilerService;
  readonly environment: CompilationEnvironmentResolver;
  readonly hashContent: SessionContentHasher;
  /** Padrão: todo rascunho novo entra no pipeline imediatamente. */
  readonly autoCompile?: boolean;
}

export interface CompileDocumentSessionOptions {
  readonly profileId?: string;
}

/**
 * `keep-local`: aceita a revisão externa como nova base do arquivo persistido
 * sem tocar no rascunho — o próximo `save()` sobrescreve o disco com o
 * rascunho local. `reload-external`: descarta o rascunho e recarrega do
 * disco, igual ao que já acontece automaticamente quando a sessão está limpa.
 */
export type ExternalConflictResolution = 'keep-local' | 'reload-external';

export interface DocumentSessions {
  open(fileId: WorkspaceFileId): Promise<DocumentSessionSnapshot>;
  close(fileId: WorkspaceFileId): void;
  snapshot(fileId: WorkspaceFileId): DocumentSessionSnapshot | undefined;
  replaceContent(fileId: WorkspaceFileId, content: string): DocumentSessionSnapshot;
  save(fileId: WorkspaceFileId): Promise<DocumentSessionSnapshot>;
  /** Sem efeito se a sessão não tiver um conflito externo pendente. */
  resolveExternalConflict(
    fileId: WorkspaceFileId,
    resolution: ExternalConflictResolution,
  ): Promise<DocumentSessionSnapshot>;
  compile(
    fileId: WorkspaceFileId,
    options?: CompileDocumentSessionOptions,
  ): Promise<DocumentSessionSnapshot | undefined>;
  /** Aguarda o trabalho agendado até agora; útil para hosts headless e testes. */
  idle(fileId?: WorkspaceFileId): Promise<void>;
  subscribe(listener: DocumentSessionEventListener): () => void;
  dispose(): Promise<void>;
}
