/**
 * @abnt/workspace-index — projeção SQLite/FTS5 reconstruível do vault.
 *
 * Não é fonte de verdade e não importa Electron, UI, compiler ou standards.
 */

export { WORKSPACE_INDEX_SCHEMA_VERSION } from './model.js';
export type {
  IndexedBlock,
  IndexedBlockKind,
  IndexedCitation,
  IndexedDocumentTitle,
  IndexedHeading,
  IndexedLink,
  IndexedLinkKind,
  IndexedResource,
  IndexFingerprint,
  IndexSynchronizationResult,
  WorkspaceIndex,
  WorkspaceIndexOptions,
  WorkspaceIndexStats,
  WorkspaceSearchResult,
} from './model.js';
export { WORKSPACE_INDEX_MIGRATIONS, migrateWorkspaceIndex } from './migrations.js';
export type { WorkspaceIndexMigration } from './migrations.js';
export { SqliteWorkspaceIndex } from './workspace-index.js';
