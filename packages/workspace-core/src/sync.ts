import type { WorkspaceId } from './model.js';
import {
  FULL_WORKSPACE_STORAGE_CAPABILITIES,
  type WorkspaceStorageCapabilities,
} from './storage.js';

/** A classificação é uma política explícita, não uma inferência por backend. */
export type WorkspaceStateClassification =
  | 'authorial'
  | 'portable-operational'
  | 'machine-local'
  | 'rebuildable';

/** Partes conhecidas do vault ou do estado de produto que exigem política de sync. */
export type WorkspaceStateResource =
  | 'vault-content'
  | 'workspace-identity'
  | 'workspace-configuration'
  | 'pdf-annotations'
  | 'reading-queue'
  | 'research-projects'
  | 'collections'
  | 'saved-searches'
  | 'writing-goals'
  | 'review-comments'
  | 'history-snapshots'
  | 'submission-records'
  | 'reference-inbox'
  | 'citation-intents'
  | 'collaboration'
  | 'academic-views'
  | 'workspace-home'
  | 'workspace-themes'
  | 'workspace-extensions'
  | 'research-canvases'
  | 'academic-relations'
  | 'reference-relations'
  | 'annotation-color-semantics'
  | 'literature-subscriptions'
  | 'literature-feed-inbox'
  | 'systematic-review'
  | 'research-datasets'
  | 'bookmarks'
  | 'recent-files'
  | 'window-layout'
  | 'focus-mode'
  | 'keybindings'
  | 'command-recency'
  | 'onboarding'
  | 'sqlite-index'
  | 'preview-cache'
  | 'graph-cache'
  | 'statistics-cache'
  | 'diagnostics-cache';

export interface WorkspaceStatePolicy {
  readonly resource: WorkspaceStateResource;
  readonly classification: WorkspaceStateClassification;
  readonly reason: string;
}

/**
 * A lista é deliberadamente fechada: estado operacional novo não passa a
 * viajar entre máquinas até receber uma decisão de produto/ADR.
 */
export const WORKSPACE_STATE_POLICIES: readonly WorkspaceStatePolicy[] = [
  { resource: 'vault-content', classification: 'authorial', reason: 'Markdown, biblioteca canônica, assets e anexos pertencem ao usuário.' },
  { resource: 'workspace-identity', classification: 'portable-operational', reason: 'FileId, DocumentId e revisões estabilizam identidade sem substituir os arquivos autorais.' },
  { resource: 'workspace-configuration', classification: 'portable-operational', reason: 'Profile padrão e paths ignorados são configuração do vault, não cache da máquina.' },
  { resource: 'pdf-annotations', classification: 'portable-operational', reason: 'Anotações de leitura são trabalho local do pesquisador, separado do PDF autoral.' },
  { resource: 'reading-queue', classification: 'portable-operational', reason: 'Fila de leitura acompanha o trabalho do vault.' },
  { resource: 'research-projects', classification: 'portable-operational', reason: 'Projetos agrupam fontes existentes sem mover arquivos.' },
  { resource: 'collections', classification: 'portable-operational', reason: 'Collections organizam IDs de documentos e referências.' },
  { resource: 'saved-searches', classification: 'portable-operational', reason: 'Consultas salvas são organização reutilizável do vault.' },
  { resource: 'writing-goals', classification: 'portable-operational', reason: 'Metas pertencem ao fluxo acadêmico do vault.' },
  { resource: 'review-comments', classification: 'portable-operational', reason: 'Comentários são revisão operacional, não Markdown publicado.' },
  { resource: 'history-snapshots', classification: 'portable-operational', reason: 'Snapshots são histórico local que pode acompanhar o vault sem se tornar autoria.' },
  { resource: 'submission-records', classification: 'portable-operational', reason: 'Registros reproduzíveis de submissão acompanham o projeto.' },
  { resource: 'reference-inbox', classification: 'portable-operational', reason: 'Inbox revisável pertence ao fluxo de pesquisa, não à biblioteca canônica.' },
  { resource: 'citation-intents', classification: 'portable-operational', reason: 'Intenções de citação são anotações locais, não conteúdo normativo.' },
  { resource: 'collaboration', classification: 'portable-operational', reason: 'Papéis, threads, atribuições e marcos pertencem ao projeto compartilhado, fora do Markdown.' },
  { resource: 'academic-views', classification: 'portable-operational', reason: 'Definições de views são configuração portátil; linhas e totais continuam projeções reconstruíveis.' },
  { resource: 'workspace-home', classification: 'portable-operational', reason: 'A composição da Home aponta para dados existentes e acompanha o vault sem copiar conteúdo.' },
  { resource: 'workspace-themes', classification: 'portable-operational', reason: 'Temas são preferências declarativas e validadas do workspace, não CSS executável.' },
  { resource: 'workspace-extensions', classification: 'portable-operational', reason: 'Configuração e permissões declaradas de extensões acompanham o workspace, sem conceder acesso implícito.' },
  { resource: 'research-canvases', classification: 'portable-operational', reason: 'Canvas organiza referências e argumentos sem alterar a autoria Markdown.' },
  { resource: 'academic-relations', classification: 'portable-operational', reason: 'Vínculos de projeto, dataset e evidência organizam entidades existentes sem copiar conteúdo.' },
  { resource: 'reference-relations', classification: 'portable-operational', reason: 'Relação explícita entre duas referências (versão/extensão/réplica/revisão/correção) organiza a biblioteca sem copiar CSL-JSON.' },
  { resource: 'annotation-color-semantics', classification: 'portable-operational', reason: 'Mapa cor→rótulo é preferência de pesquisa reutilizável entre sessões, não conteúdo do PDF nem da anotação em si.' },
  { resource: 'literature-subscriptions', classification: 'portable-operational', reason: 'Assinaturas de feed são configuração de monitoramento do pesquisador, não conteúdo autoral.' },
  { resource: 'literature-feed-inbox', classification: 'portable-operational', reason: 'Itens de feed aguardando revisão nunca são a biblioteca canônica; é fila operacional, como o reference-inbox.' },
  { resource: 'systematic-review', classification: 'portable-operational', reason: 'Protocolo, triagem e extração organizam revisão reproduzível sem substituir Markdown ou CSL-JSON.' },
  { resource: 'research-datasets', classification: 'portable-operational', reason: 'Metadados, hashes e proveniência descrevem datasets armazenados no vault sem duplicar seus bytes.' },
  { resource: 'bookmarks', classification: 'portable-operational', reason: 'Atalhos apontam para entidades existentes e acompanham o vault sem duplicar conteúdo.' },
  { resource: 'recent-files', classification: 'machine-local', reason: 'Recência depende da máquina e não altera o vault.' },
  { resource: 'window-layout', classification: 'machine-local', reason: 'Layout depende de tela e preferência do dispositivo.' },
  { resource: 'focus-mode', classification: 'machine-local', reason: 'Modo de foco é composição transitória da interface.' },
  { resource: 'keybindings', classification: 'machine-local', reason: 'Atalhos são preferência do usuário naquela máquina.' },
  { resource: 'command-recency', classification: 'machine-local', reason: 'Recência da palette não é dado compartilhável do vault.' },
  { resource: 'onboarding', classification: 'machine-local', reason: 'Onboarding não acompanha o trabalho acadêmico.' },
  { resource: 'sqlite-index', classification: 'rebuildable', reason: 'SQLite/FTS é projeção descartável do filesystem.' },
  { resource: 'preview-cache', classification: 'rebuildable', reason: 'Preview deriva da sessão e da publicação.' },
  { resource: 'graph-cache', classification: 'rebuildable', reason: 'Grafo é projeção das fontes e do índice.' },
  { resource: 'statistics-cache', classification: 'rebuildable', reason: 'Estatísticas são derivadas das fontes.' },
  { resource: 'diagnostics-cache', classification: 'rebuildable', reason: 'Diagnósticos são recompiláveis a partir da autoria.' },
];

const policyByResource = new Map(WORKSPACE_STATE_POLICIES.map((policy) => [policy.resource, policy] as const));

export function workspaceStatePolicy(resource: WorkspaceStateResource): WorkspaceStatePolicy {
  const policy = policyByResource.get(resource);
  if (policy === undefined) throw new Error(`Estado de workspace sem política: ${resource}.`);
  return policy;
}

export function isPortableWorkspaceState(resource: WorkspaceStateResource): boolean {
  return workspaceStatePolicy(resource).classification === 'portable-operational';
}

export type WorkspaceJsonValue = null | boolean | number | string | readonly WorkspaceJsonValue[] | { readonly [key: string]: WorkspaceJsonValue };

export const PORTABLE_WORKSPACE_STATE_SCHEMA = 'folio-portable-workspace-state' as const;
export const PORTABLE_WORKSPACE_STATE_VERSION = 1 as const;

/** Representação versionada para estado operacional que poderá viajar entre máquinas. */
export interface PortableWorkspaceStateEntry {
  readonly id: string;
  readonly resource: Extract<WorkspaceStateResource,
    | 'pdf-annotations'
    | 'reading-queue'
    | 'research-projects'
    | 'collections'
    | 'saved-searches'
    | 'writing-goals'
    | 'review-comments'
    | 'history-snapshots'
    | 'submission-records'
    | 'reference-inbox'
    | 'citation-intents'
    | 'collaboration'
    | 'academic-views'
    | 'workspace-home'
    | 'workspace-themes'
    | 'workspace-extensions'
    | 'research-canvases'
    | 'academic-relations'
    | 'reference-relations'
    | 'annotation-color-semantics'
    | 'literature-subscriptions'
    | 'literature-feed-inbox'
    | 'systematic-review'
    | 'research-datasets'
    | 'bookmarks'>;
  /** Revisão da entidade operacional, independente da revisão de um Markdown. */
  readonly revision: string;
  readonly value: WorkspaceJsonValue;
}

export interface PortableWorkspaceState {
  readonly schema: typeof PORTABLE_WORKSPACE_STATE_SCHEMA;
  readonly version: typeof PORTABLE_WORKSPACE_STATE_VERSION;
  readonly workspaceId: WorkspaceId;
  readonly entries: readonly PortableWorkspaceStateEntry[];
}

export function createPortableWorkspaceState(
  workspaceId: WorkspaceId,
  entries: readonly PortableWorkspaceStateEntry[],
): PortableWorkspaceState {
  const unique = new Set<string>();
  for (const entry of entries) {
    if (!isPortableWorkspaceState(entry.resource)) throw new Error(`Estado não portátil: ${entry.resource}.`);
    const key = `${entry.resource}:${entry.id}`;
    if (unique.has(key)) throw new Error(`Estado operacional duplicado: ${key}.`);
    unique.add(key);
  }
  return {
    schema: PORTABLE_WORKSPACE_STATE_SCHEMA,
    version: PORTABLE_WORKSPACE_STATE_VERSION,
    workspaceId,
    entries: [...entries].sort((left, right) => `${left.resource}:${left.id}`.localeCompare(`${right.resource}:${right.id}`)),
  };
}

/** Entidades que conflitam por regras diferentes — somente texto pode oferecer merge manual. */
export type WorkspaceSyncEntityKind = 'text' | 'reference' | 'annotation' | 'project' | 'collection' | 'workspace-state';
export type WorkspaceSyncOperation = 'upsert' | 'delete' | 'rename';

export interface WorkspaceSyncChange {
  readonly entity: { readonly kind: WorkspaceSyncEntityKind; readonly id: string };
  readonly operation: WorkspaceSyncOperation;
  readonly revision: string;
  readonly contentHash?: string;
  readonly path?: string;
}

export type WorkspaceSyncConflictKind =
  | 'text-conflict'
  | 'reference-conflict'
  | 'annotation-conflict'
  | 'project-conflict'
  | 'collection-conflict'
  | 'workspace-state-conflict'
  | 'delete-edit-conflict'
  | 'rename-edit-conflict';

export interface WorkspaceSyncConflict {
  readonly kind: WorkspaceSyncConflictKind;
  readonly resolution: 'manual-text-merge' | 'manual-entity-review';
  readonly local: WorkspaceSyncChange;
  readonly remote: WorkspaceSyncChange;
}

const sameChange = (left: WorkspaceSyncChange, right: WorkspaceSyncChange): boolean =>
  left.operation === right.operation && left.contentHash === right.contentHash && left.path === right.path;

const entityConflictKind: Record<WorkspaceSyncEntityKind, WorkspaceSyncConflictKind> = {
  text: 'text-conflict',
  reference: 'reference-conflict',
  annotation: 'annotation-conflict',
  project: 'project-conflict',
  collection: 'collection-conflict',
  'workspace-state': 'workspace-state-conflict',
};

/** Classifica conflitos; não resolve nenhum automaticamente. */
export function classifyWorkspaceSyncConflict(
  local: WorkspaceSyncChange,
  remote: WorkspaceSyncChange,
): WorkspaceSyncConflict | undefined {
  if (local.entity.kind !== remote.entity.kind || local.entity.id !== remote.entity.id || sameChange(local, remote)) return undefined;
  const kind = local.operation === 'delete' || remote.operation === 'delete'
    ? 'delete-edit-conflict'
    : local.operation === 'rename' || remote.operation === 'rename'
      ? 'rename-edit-conflict'
      : entityConflictKind[local.entity.kind];
  return { kind, resolution: kind === 'text-conflict' ? 'manual-text-merge' : 'manual-entity-review', local, remote };
}

export function classifyWorkspaceSyncConflicts(
  local: readonly WorkspaceSyncChange[],
  remote: readonly WorkspaceSyncChange[],
): readonly WorkspaceSyncConflict[] {
  const byEntity = new Map(remote.map((change) => [`${change.entity.kind}:${change.entity.id}`, change] as const));
  return local.flatMap((change) => {
    const other = byEntity.get(`${change.entity.kind}:${change.entity.id}`);
    const conflict = other === undefined ? undefined : classifyWorkspaceSyncConflict(change, other);
    return conflict === undefined ? [] : [conflict];
  });
}

export type WorkspaceSyncContent = WorkspaceJsonValue | Uint8Array;

export interface WorkspaceSyncRecord {
  readonly key: string;
  readonly resource: WorkspaceStateResource;
  readonly revision: string;
  readonly contentHash: string;
  readonly content: WorkspaceSyncContent;
}

/** Exclusão propagável: impede que um dispositivo antigo ressuscite um registro removido. */
export interface WorkspaceSyncTombstone {
  readonly key: string;
  readonly resource: WorkspaceStateResource;
  readonly revision: string;
  readonly deletedAt: string;
}

export interface WriteWorkspaceSyncRecordRequest {
  readonly key: string;
  readonly resource: WorkspaceStateResource;
  readonly contentHash: string;
  readonly content: WorkspaceSyncContent;
  readonly expectedRevision?: string;
}

export interface RenameWorkspaceSyncRecordRequest {
  readonly key: string;
  readonly destinationKey: string;
  readonly expectedRevision?: string;
}

export interface DeleteWorkspaceSyncRecordRequest {
  readonly key: string;
  readonly expectedRevision?: string;
}

export type WorkspaceSyncEvent =
  | { readonly type: 'written'; readonly record: WorkspaceSyncRecord }
  | { readonly type: 'renamed'; readonly record: WorkspaceSyncRecord; readonly previousKey: string }
  | { readonly type: 'deleted'; readonly key: string; readonly revision: string };

export type WorkspaceSyncEventListener = (event: WorkspaceSyncEvent) => void;

export interface WorkspaceSyncPollResult {
  readonly cursor: string;
  readonly events: readonly WorkspaceSyncEvent[];
}

/**
 * Borda para um futuro adapter remoto. Não pressupõe filesystem, rede, conta
 * ou protocolo: cada operação opcional só pode ser chamada após checar a
 * capability correspondente.
 */
export interface WorkspaceSyncAdapter {
  readonly capabilities: WorkspaceStorageCapabilities;
  list(): Promise<readonly WorkspaceSyncRecord[]>;
  read(key: string): Promise<WorkspaceSyncRecord | undefined>;
  write(request: WriteWorkspaceSyncRecordRequest): Promise<WorkspaceSyncRecord>;
  rename?(request: RenameWorkspaceSyncRecordRequest): Promise<WorkspaceSyncRecord>;
  delete?(request: DeleteWorkspaceSyncRecordRequest): Promise<void>;
  compareRevision?(key: string, revision: string): Promise<boolean>;
  subscribe?(listener: WorkspaceSyncEventListener): () => void;
  poll?(cursor?: string): Promise<WorkspaceSyncPollResult>;
  listTombstones?(): Promise<readonly WorkspaceSyncTombstone[]>;
}

export class WorkspaceSyncRevisionConflictError extends Error {
  readonly key: string;
  readonly expectedRevision: string;
  readonly actualRevision: string | undefined;

  constructor(key: string, expectedRevision: string, actualRevision: string | undefined) {
    super(`Conflito de revisão para ${key}: esperada ${expectedRevision}, atual ${actualRevision ?? 'ausente'}.`);
    this.name = 'WorkspaceSyncRevisionConflictError';
    this.key = key;
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

const cloneContent = (content: WorkspaceSyncContent): WorkspaceSyncContent => content instanceof Uint8Array ? new Uint8Array(content) : content;
const cloneRecord = (record: WorkspaceSyncRecord): WorkspaceSyncRecord => ({ ...record, content: cloneContent(record.content) });

/** Adapter determinístico em memória, exclusivo de teste/simulação — não é cloud. */
export class InMemoryWorkspaceSyncAdapter implements WorkspaceSyncAdapter {
  readonly capabilities: WorkspaceStorageCapabilities = FULL_WORKSPACE_STORAGE_CAPABILITIES;
  readonly #records = new Map<string, WorkspaceSyncRecord>();
  readonly #listeners = new Set<WorkspaceSyncEventListener>();
  readonly #events: { readonly sequence: number; readonly event: WorkspaceSyncEvent }[] = [];
  readonly #tombstones = new Map<string, WorkspaceSyncTombstone>();
  #sequence = 0;
  #revision = 0;

  async list(): Promise<readonly WorkspaceSyncRecord[]> {
    return [...this.#records.values()].map(cloneRecord).sort((left, right) => left.key.localeCompare(right.key));
  }

  async read(key: string): Promise<WorkspaceSyncRecord | undefined> {
    const record = this.#records.get(key);
    return record === undefined ? undefined : cloneRecord(record);
  }

  async write(request: WriteWorkspaceSyncRecordRequest): Promise<WorkspaceSyncRecord> {
    const current = this.#records.get(request.key);
    this.#assertExpected(request.key, request.expectedRevision, current?.revision);
    const record: WorkspaceSyncRecord = {
      key: request.key,
      resource: request.resource,
      revision: String(++this.#revision),
      contentHash: request.contentHash,
      content: cloneContent(request.content),
    };
    this.#records.set(record.key, record);
    this.#tombstones.delete(record.key);
    this.#emit({ type: 'written', record: cloneRecord(record) });
    return cloneRecord(record);
  }

  async rename(request: RenameWorkspaceSyncRecordRequest): Promise<WorkspaceSyncRecord> {
    const current = this.#records.get(request.key);
    if (current === undefined) throw new Error(`Registro de sync inexistente: ${request.key}.`);
    this.#assertExpected(request.key, request.expectedRevision, current.revision);
    if (this.#records.has(request.destinationKey)) throw new Error(`Destino de sync já existe: ${request.destinationKey}.`);
    const record: WorkspaceSyncRecord = { ...current, key: request.destinationKey, revision: String(++this.#revision) };
    this.#records.delete(request.key);
    this.#records.set(record.key, record);
    this.#emit({ type: 'renamed', record: cloneRecord(record), previousKey: request.key });
    return cloneRecord(record);
  }

  async delete(request: DeleteWorkspaceSyncRecordRequest): Promise<void> {
    const current = this.#records.get(request.key);
    this.#assertExpected(request.key, request.expectedRevision, current?.revision);
    if (current === undefined) return;
    this.#records.delete(request.key);
    const revision = String(++this.#revision);
    this.#tombstones.set(request.key, { key: request.key, resource: current.resource, revision, deletedAt: new Date().toISOString() });
    this.#emit({ type: 'deleted', key: request.key, revision });
  }

  async listTombstones(): Promise<readonly WorkspaceSyncTombstone[]> { return [...this.#tombstones.values()].map((item) => ({ ...item })).sort((left, right) => left.key.localeCompare(right.key)); }

  async compareRevision(key: string, revision: string): Promise<boolean> {
    return this.#records.get(key)?.revision === revision;
  }

  subscribe(listener: WorkspaceSyncEventListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async poll(cursor = '0'): Promise<WorkspaceSyncPollResult> {
    const from = Number.parseInt(cursor, 10);
    const sequence = Number.isFinite(from) ? from : 0;
    return { cursor: String(this.#sequence), events: this.#events.filter((entry) => entry.sequence > sequence).map((entry) => entry.event) };
  }

  #assertExpected(key: string, expected: string | undefined, actual: string | undefined): void {
    if (expected !== undefined && expected !== actual) throw new WorkspaceSyncRevisionConflictError(key, expected, actual);
  }

  #emit(event: WorkspaceSyncEvent): void {
    const sequence = ++this.#sequence;
    this.#events.push({ sequence, event });
    for (const listener of this.#listeners) listener(event);
  }
}

/** Copia explicitamente um registro entre dois adapters, útil para simulações sem rede. */
export async function replicateWorkspaceSyncRecord(
  source: WorkspaceSyncAdapter,
  destination: WorkspaceSyncAdapter,
  key: string,
): Promise<WorkspaceSyncRecord | undefined> {
  const record = await source.read(key);
  if (record === undefined) return undefined;
  const previous = await destination.read(key);
  return destination.write({
    key: record.key,
    resource: record.resource,
    contentHash: record.contentHash,
    content: record.content,
    ...(previous !== undefined ? { expectedRevision: previous.revision } : {}),
  });
}
