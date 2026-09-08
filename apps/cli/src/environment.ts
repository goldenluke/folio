import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename, extname, isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { asContentHash } from '@abnt/compiler';
import type {
  BibliographyProvenance,
  BibliographySource,
  EnvironmentPreparation,
  PreparedCompilation,
  ResourceResolution,
} from '@abnt/compiler';
import { importarBibtex } from '@abnt/bibliography';
import type { BibliographicEntity, Diagnostic, Registry } from '@abnt/document-model';

const TIPOS: Readonly<Record<string, string>> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};

const EXTERNA = /^[a-z][a-z0-9+.-]*:/i;

export interface OpcoesDeAmbienteLocal {
  /** Diretório contra o qual URIs autorais relativas serão resolvidas. */
  readonly baseDir?: string;
  /** Embute recursos para exportação PDF via `page.setContent`. */
  readonly embutirRecursos?: boolean;
  /** Bibliografia já normalizada, útil para embedding sem filesystem. */
  readonly references?: Registry<BibliographicEntity>;
  readonly signal?: AbortSignal;
}

const checkCancelled = (signal?: AbortSignal): void => {
  if (signal?.aborted === true) throw new Error('Preparação do ambiente cancelada.');
};

const contentHash = (content: string | Uint8Array) =>
  asContentHash(`sha256:${createHash('sha256').update(content).digest('hex')}`);

/**
 * Adapter local do host. A leitura de disco, URL file:// e data URI vivem
 * aqui, nunca no compiler nem no Document AST.
 */
export async function prepararAmbienteLocal(
  prepared: PreparedCompilation,
  options: OpcoesDeAmbienteLocal = {},
): Promise<EnvironmentPreparation> {
  const diagnostics: Diagnostic[] = [];
  const entries: Record<string, BibliographicEntity> = { ...(options.references ?? {}) };
  const sources: BibliographySource[] = [];
  const provenanceByReference: Record<string, readonly BibliographyProvenance[]> = {};

  if (options.references !== undefined && Object.keys(options.references).length > 0) {
    const source: BibliographySource = { id: 'memory:references', format: 'memory' };
    sources.push(source);
    for (const id of Object.keys(options.references)) {
      provenanceByReference[id] = [{ sourceId: source.id }];
    }
  }

  if (prepared.dependencies.bibliographyUris.length > 0 && options.baseDir === undefined) {
    diagnostics.push({
      id: 'BIBLIOGRAFIA-BASE-AUSENTE',
      severity: 'error',
      message: 'Não foi possível resolver bibliography sem um diretório base.',
    });
  }

  if (options.baseDir !== undefined) {
    for (const [index, authoredUri] of prepared.dependencies.bibliographyUris.entries()) {
      checkCancelled(options.signal);
      const path = resolve(options.baseDir, authoredUri);
      try {
        const content = await readFile(path, 'utf8');
        checkCancelled(options.signal);
        const source: BibliographySource = {
          id: `bibliography:${index + 1}`,
          authoredUri,
          resolvedUri: pathToFileURL(path).href,
          format: 'bibtex',
          contentHash: contentHash(content),
        };
        sources.push(source);
        const imported = importarBibtex(content, { documentId: basename(path) });
        diagnostics.push(...imported.diagnostics);

        for (const [id, entry] of Object.entries(imported.references)) {
          if (entries[id] !== undefined) {
            diagnostics.push({
              id: 'BIBLIOGRAFIA-CHAVE-DUPLICADA',
              severity: 'error',
              message: `A chave bibliográfica "${id}" aparece em mais de uma fonte.`,
            });
            continue;
          }
          entries[id] = entry;
          provenanceByReference[id] = [
            {
              sourceId: source.id,
              ...(source.resolvedUri !== undefined ? { sourceUri: source.resolvedUri } : {}),
            },
          ];
        }
      } catch (error) {
        diagnostics.push({
          id: 'BIBLIOGRAFIA-LEITURA',
          severity: 'error',
          message: `Não foi possível ler "${authoredUri}": ${(error as Error).message}`,
        });
      }
    }
  }

  const resources: Record<string, ResourceResolution> = {};
  if (options.baseDir !== undefined) {
    for (const dependency of prepared.dependencies.resources) {
      checkCancelled(options.signal);
      const resource = prepared.document.resources[dependency.resourceId];
      if (resource === undefined) continue;

      if (EXTERNA.test(resource.uri)) {
        resources[dependency.resourceId] = {
          resourceId: resource.id,
          authoredUri: resource.uri,
          status: 'external',
          resolvedUri: resource.uri,
          ...(resource.mediaType !== undefined ? { mediaType: resource.mediaType } : {}),
        };
        continue;
      }

      const path = isAbsolute(resource.uri) ? resource.uri : resolve(options.baseDir, resource.uri);
      try {
        const content = await readFile(path);
        checkCancelled(options.signal);
        const mediaType = TIPOS[extname(path).toLowerCase()];
        const type = mediaType ?? 'application/octet-stream';
        resources[dependency.resourceId] = {
          resourceId: resource.id,
          authoredUri: resource.uri,
          status: 'resolved',
          resolvedUri:
            options.embutirRecursos === true
              ? `data:${type};base64,${content.toString('base64')}`
              : pathToFileURL(path).href,
          ...(mediaType !== undefined ? { mediaType } : {}),
          contentHash: contentHash(content),
        };
      } catch {
        diagnostics.push({
          id: 'RECURSO-NAO-ENCONTRADO',
          severity: 'error',
          message: `Arquivo não encontrado: ${resource.uri}`,
        });
        resources[dependency.resourceId] = {
          resourceId: resource.id,
          authoredUri: resource.uri,
          status: 'missing',
        };
      }
    }
  }

  return {
    environment: {
      bibliography: { entries, sources, provenanceByReference },
      resources,
      dependencies: { bibliography: sources, resources: Object.values(resources) },
    },
    diagnostics,
  };
}
