import type Database from 'better-sqlite3';

import { WORKSPACE_INDEX_SCHEMA_VERSION } from './model.js';

type SqliteDatabase = Database.Database;

export interface WorkspaceIndexMigration {
  readonly version: number;
  readonly description: string;
  apply(database: SqliteDatabase): void;
}

/**
 * O índice não migra arquivos autorais; somente sua projeção local. Ainda assim
 * a cadeia é explícita para que upgrades preservem caches quando for seguro.
 */
export const WORKSPACE_INDEX_MIGRATIONS: readonly WorkspaceIndexMigration[] = [
  {
    version: 1,
    description: 'arquivos, relações estruturais e FTS5 inicial',
    apply: (database) => {
      database.exec(`
        CREATE TABLE index_migrations (
          version INTEGER PRIMARY KEY NOT NULL,
          applied_at INTEGER NOT NULL
        );

        CREATE TABLE indexed_files (
          file_id TEXT PRIMARY KEY NOT NULL,
          document_id TEXT,
          path TEXT NOT NULL UNIQUE,
          revision INTEGER NOT NULL,
          content_hash TEXT NOT NULL,
          media_type TEXT,
          is_markdown INTEGER NOT NULL,
          indexed_at INTEGER NOT NULL
        );

        CREATE TABLE indexed_headings (
          file_id TEXT NOT NULL REFERENCES indexed_files(file_id) ON DELETE CASCADE,
          node_id TEXT NOT NULL,
          depth INTEGER NOT NULL,
          title TEXT NOT NULL,
          role TEXT,
          source_start INTEGER,
          source_end INTEGER,
          PRIMARY KEY (file_id, node_id)
        );
        CREATE INDEX indexed_headings_file ON indexed_headings(file_id, depth);

        CREATE TABLE indexed_links (
          file_id TEXT NOT NULL REFERENCES indexed_files(file_id) ON DELETE CASCADE,
          node_id TEXT NOT NULL,
          target TEXT NOT NULL,
          kind TEXT NOT NULL,
          label TEXT NOT NULL,
          source_start INTEGER,
          source_end INTEGER,
          PRIMARY KEY (file_id, node_id, target)
        );
        CREATE INDEX indexed_links_target ON indexed_links(target);

        CREATE TABLE indexed_citations (
          file_id TEXT NOT NULL REFERENCES indexed_files(file_id) ON DELETE CASCADE,
          node_id TEXT NOT NULL,
          reference_id TEXT NOT NULL,
          mode TEXT NOT NULL,
          locator_type TEXT,
          locator_value TEXT,
          source_start INTEGER,
          source_end INTEGER,
          PRIMARY KEY (file_id, node_id, reference_id)
        );
        CREATE INDEX indexed_citations_reference ON indexed_citations(reference_id);

        CREATE TABLE indexed_resources (
          file_id TEXT NOT NULL REFERENCES indexed_files(file_id) ON DELETE CASCADE,
          resource_id TEXT NOT NULL,
          uri TEXT NOT NULL,
          media_type TEXT,
          integrity TEXT,
          PRIMARY KEY (file_id, resource_id)
        );
        CREATE INDEX indexed_resources_uri ON indexed_resources(uri);

        CREATE VIRTUAL TABLE document_fts USING fts5(
          file_id UNINDEXED,
          path UNINDEXED,
          title,
          content,
          tokenize = 'unicode61 remove_diacritics 2'
        );
      `);
    },
  },
  {
    version: 2,
    description: 'blocos estruturais (figura/tabela) para busca estruturada (has:figure, has:table)',
    apply: (database) => {
      database.exec(`
        CREATE TABLE indexed_blocks (
          file_id TEXT NOT NULL REFERENCES indexed_files(file_id) ON DELETE CASCADE,
          node_id TEXT NOT NULL,
          kind TEXT NOT NULL,
          source_start INTEGER,
          source_end INTEGER,
          PRIMARY KEY (file_id, node_id)
        );
        CREATE INDEX indexed_blocks_kind ON indexed_blocks(kind);
      `);
    },
  },
  {
    version: 3,
    description: 'identificadores e ocorrências de cross-reference (F68) — navegação vault-wide de [[ref:id]]',
    apply: (database) => {
      database.exec(`
        CREATE TABLE indexed_identifiers (
          file_id TEXT NOT NULL REFERENCES indexed_files(file_id) ON DELETE CASCADE,
          node_id TEXT NOT NULL,
          identifier TEXT NOT NULL,
          kind TEXT NOT NULL,
          label TEXT NOT NULL,
          source_start INTEGER,
          source_end INTEGER,
          PRIMARY KEY (file_id, node_id)
        );
        CREATE INDEX indexed_identifiers_identifier ON indexed_identifiers(identifier);

        CREATE TABLE indexed_xrefs (
          file_id TEXT NOT NULL REFERENCES indexed_files(file_id) ON DELETE CASCADE,
          node_id TEXT NOT NULL,
          identifier TEXT NOT NULL,
          source_start INTEGER,
          source_end INTEGER,
          PRIMARY KEY (file_id, node_id)
        );
        CREATE INDEX indexed_xrefs_identifier ON indexed_xrefs(identifier);
      `);
    },
  },
];

export function migrateWorkspaceIndex(database: SqliteDatabase): number {
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  const current = Number(database.pragma('user_version', { simple: true }));
  if (current > WORKSPACE_INDEX_SCHEMA_VERSION) {
    throw new Error(
      `Índice criado por schema v${current}; esta build suporta até v${WORKSPACE_INDEX_SCHEMA_VERSION}.`,
    );
  }

  const pending = WORKSPACE_INDEX_MIGRATIONS.filter((migration) => migration.version > current);
  database.transaction(() => {
    for (const migration of pending) {
      migration.apply(database);
      database
        .prepare('INSERT INTO index_migrations (version, applied_at) VALUES (?, ?)')
        .run(migration.version, Date.now());
      database.pragma(`user_version = ${migration.version}`);
    }
  })();
  return WORKSPACE_INDEX_SCHEMA_VERSION;
}
