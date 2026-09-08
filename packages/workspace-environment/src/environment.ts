import { importarBibtex } from '@abnt/bibliography';
import type { BibliographicEntity } from '@abnt/document-model';
import { documentTarget } from '@abnt/language-service';
import { expandMarkdownComposition } from '@abnt/markdown';
import {
  protocolOk,
  type BibliographyProvenanceDto,
  type BibliographySourceDto,
  type DiagnosticDto,
  type EnvironmentPreparationDto,
} from '@abnt/protocol';
import { locateRangeInComposite, type CompositeSourceMap } from '@abnt/source-composition';
import type { WorkspaceStorage } from '@abnt/workspace-core';
import type { CompilationEnvironmentRequest, CompilationEnvironmentResolver } from '@abnt/workspace-sessions';

/**
 * F67 — traduz um diagnóstico do compiler (offset na fonte virtual composta
 * pelo F60–F62) para o arquivo autoral real. Só reescreve quando o
 * diagnóstico pertence ao documento raiz (`rootDocumentId`) — um diagnóstico
 * que já cita outro arquivo (ex.: bibliografia) não é tocado. Sem origem
 * autoral única no mapa, o diagnóstico original é preservado: nunca inventa
 * uma localização (item 12 do ADR 0054).
 */
function remapDiagnostic(diagnostic: DiagnosticDto, sourceMap: CompositeSourceMap, rootDocumentId: string): DiagnosticDto {
  const { source } = diagnostic;
  if (source === undefined || source.documentId !== rootDocumentId) return diagnostic;
  const origin = locateRangeInComposite(sourceMap, source.start.offset, source.end.offset);
  if (origin.kind !== 'authored') return diagnostic;
  return {
    ...diagnostic,
    source: { documentId: origin.path, start: { offset: origin.start }, end: { offset: origin.end } },
  };
}

import { LIBRARY_PATH, readVaultLibrary } from './library.js';

/**
 * Resolve dependências bibliográficas (`.bib`) declaradas no frontmatter do
 * documento, via `WorkspaceStorage` — nunca `node:fs` diretamente. Mesma
 * forma que `apps/cli/src/environment.ts` já resolve para o CLI, adaptada ao
 * vault em vez de um diretório base do sistema operacional.
 *
 * Extraído de `apps/desktop` em P13 para o LSP reaproveitar sem duplicar:
 * qualquer host que precise compilar com bibliografia de verdade (desktop,
 * LSP, e futuros) usa esta mesma função — não uma cópia local que diverge no
 * primeiro caso de borda. Resolução de recursos (imagens) fica de fora por
 * ora — mesma lacuna já registrada no preview do P10. Ver ADR 0017 e 0018.
 *
 * F37 (biblioteca vault-wide): antes de resolver `.bib`s declarados no
 * frontmatter, mescla `references/library.json` (F6) como uma fonte sempre
 * disponível — todo documento pode citar qualquer entrada da biblioteca do
 * vault, mesmo sem declarar `bibliography:`. `.bib`s declarados pelo próprio
 * documento sobrescrevem uma chave da biblioteca silenciosamente (mais
 * específico vence); dois `.bib`s do MESMO documento colidindo na mesma
 * chave continua erro, como antes. Ver ADR 0039.
 */
export function criarResolvedorDeAmbienteLocal(storage: WorkspaceStorage): CompilationEnvironmentResolver {
  return {
    async expandSource(request, signal) {
      if (signal?.aborted === true) throw new Error('Expansão de composição cancelada.');
      const files = await storage.list();
      const byPath = new Map(files.map((file) => [String(file.path), file] as const));
      const expanded = await expandMarkdownComposition({
        sourcePath: String(request.file.path),
        content: request.content,
        reader: {
          async read(path) {
            if (signal?.aborted === true) throw new Error('Expansão de composição cancelada.');
            const file = byPath.get(path);
            if (file === undefined) return undefined;
            return (await storage.read(file.id)).content;
          },
        },
      });
      return {
        content: expanded.content,
        diagnostics: expanded.diagnostics.map((item): DiagnosticDto => ({
          id: item.id,
          severity: item.severity,
          message: item.message,
          ...(item.nodeId === undefined ? {} : { nodeId: String(item.nodeId) }),
          ...(item.source === undefined ? {} : { source: { documentId: String(item.source.documentId), start: item.source.start, end: item.source.end } }),
        })),
        sourceMap: expanded.sourceMap,
      };
    },
    remapCompositionDiagnostics(diagnostics, sourceMap, rootDocumentId) {
      return diagnostics.map((item) => remapDiagnostic(item, sourceMap, rootDocumentId));
    },
    async resolve(request: CompilationEnvironmentRequest) {
      const entries: Record<string, BibliographicEntity> = {};
      const sources: BibliographySourceDto[] = [];
      const provenanceByReference: Record<string, readonly BibliographyProvenanceDto[]> = {};
      const diagnostics: DiagnosticDto[] = [];
      const declaredKeys = new Set<string>();

      const libraryEntries = await readVaultLibrary(storage);
      if (Object.keys(libraryEntries).length > 0) {
        const librarySource: BibliographySourceDto = {
          id: 'library:vault',
          resolvedUri: String(LIBRARY_PATH),
          format: 'csl-json',
        };
        sources.push(librarySource);
        for (const [id, entry] of Object.entries(libraryEntries)) {
          entries[id] = entry;
          provenanceByReference[id] = [{ sourceId: librarySource.id, sourceUri: String(LIBRARY_PATH) }];
        }
      }

      const files = await storage.list();
      for (const [index, authoredUri] of request.prepared.dependencies.bibliographyUris.entries()) {
        const targetPath = documentTarget(request.file.path, authoredUri);
        if (targetPath === undefined) {
          diagnostics.push({
            id: 'BIBLIOGRAFIA-URI-INVALIDA',
            severity: 'error',
            message: `Não foi possível resolver a dependência bibliográfica "${authoredUri}".`,
          });
          continue;
        }
        const file = files.find((candidate) => String(candidate.path) === targetPath);
        if (file === undefined) {
          diagnostics.push({
            id: 'BIBLIOGRAFIA-LEITURA',
            severity: 'error',
            message: `Arquivo de bibliografia não encontrado no vault: "${targetPath}".`,
          });
          continue;
        }
        try {
          const content = await storage.read(file.id);
          const source: BibliographySourceDto = {
            id: `bibliography:${index + 1}`,
            authoredUri,
            resolvedUri: targetPath,
            format: 'bibtex',
            contentHash: String(file.contentHash),
          };
          sources.push(source);
          const imported = importarBibtex(content.content, { documentId: targetPath });
          diagnostics.push(...imported.diagnostics);
          for (const [id, entry] of Object.entries(imported.references)) {
            if (declaredKeys.has(id)) {
              diagnostics.push({
                id: 'BIBLIOGRAFIA-CHAVE-DUPLICADA',
                severity: 'error',
                message: `A chave bibliográfica "${id}" aparece em mais de uma fonte.`,
              });
              continue;
            }
            // Sobrescreve silenciosamente uma entrada vinda da biblioteca do
            // vault (F37) — `.bib` declarado pelo documento é mais
            // específico e vence, sem diagnóstico de conflito.
            entries[id] = entry;
            declaredKeys.add(id);
            provenanceByReference[id] = [{ sourceId: source.id, sourceUri: targetPath }];
          }
        } catch (error) {
          diagnostics.push({
            id: 'BIBLIOGRAFIA-LEITURA',
            severity: 'error',
            message: `Não foi possível ler "${targetPath}": ${(error as Error).message}`,
          });
        }
      }

      return protocolOk<EnvironmentPreparationDto>({
        environment: {
          bibliography: { entries, sources, provenanceByReference },
          resources: {},
          dependencies: { bibliography: sources, resources: [] },
          ...(request.workspaceConfiguration.defaultProfileId !== undefined
            ? { configuration: { defaultProfileId: request.workspaceConfiguration.defaultProfileId } }
            : {}),
        },
        diagnostics,
      });
    },
  };
}
