import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  asContentHash,
  criarCompiler,
  PERFIL_PADRAO as PERFIL_PADRAO_DO_COMPILER,
  publicationProfiles,
} from '@abnt/compiler';
import type { ContentHash, SourceSnapshot } from '@abnt/compiler';
import { asDocumentId } from '@abnt/document-model';
import type { Diagnostic, DocumentAst } from '@abnt/document-model';
import { expandMarkdownComposition } from '@abnt/markdown';
import { renderizarHtml } from '@abnt/renderer-html';
import type { PublicationDocument, PublicationProfile } from '@abnt/publication';
import type { ResolvedDocument } from '@abnt/semantics';
import type { RelatorioDeValidacao } from '@abnt/standards';

import { prepararAmbienteLocal } from './environment.js';

/** Compatibilidade da API de listagem enquanto o CLI continua público. */
export const PERFIS: Readonly<Record<string, PublicationProfile>> = publicationProfiles();
export const PERFIL_PADRAO = PERFIL_PADRAO_DO_COMPILER;

export interface EtapasDaCompilacao {
  readonly ast: DocumentAst;
  readonly resolvido: ResolvedDocument;
  readonly publicacao: PublicationDocument;
  readonly html: string;
  readonly validacao: RelatorioDeValidacao;
  readonly diagnosticos: readonly Diagnostic[];
}

export interface OpcoesDaCompilacao {
  readonly documentId?: string;
  readonly revision?: number;
  readonly perfil?: string;
  /** Diretório base para resolver dependências autorais relativas. */
  readonly baseDir?: string;
  /** Caminho do documento dentro de `baseDir`, usado por embeds modulares. */
  readonly sourcePath?: string;
  /** Embute recursos como data URI. Necessário para o caminho de PDF. */
  readonly embutirRecursos?: boolean;
  /** Registry já normalizado; útil para API/embedding sem leitura do disco. */
  readonly references?: DocumentAst['references'];
  readonly signal?: AbortSignal;
}

export function obterPerfil(nome: string): PublicationProfile {
  const perfil = PERFIS[nome];
  if (perfil === undefined) {
    throw new Error(`Perfil desconhecido: "${nome}". Disponíveis: ${Object.keys(PERFIS).join(', ')}.`);
  }
  return perfil;
}

const hashDaFonte = (fonte: string): ContentHash =>
  asContentHash(`sha256:${createHash('sha256').update(fonte).digest('hex')}`);

const snapshotDaFonte = (fonte: string, opcoes: OpcoesDaCompilacao): SourceSnapshot => ({
  documentId: asDocumentId(opcoes.documentId ?? 'documento'),
  revision: opcoes.revision ?? 0,
  content: fonte,
  contentHash: hashDaFonte(fonte),
});

/**
 * Facade de compatibilidade do CLI. A composição semântica vive em
 * `@abnt/compiler`; o único I/O daqui é a preparação do ambiente local.
 */
export async function compilar(
  fonte: string,
  opcoes: OpcoesDaCompilacao = {},
): Promise<EtapasDaCompilacao> {
  const compiler = criarCompiler();
  const composition = opcoes.baseDir === undefined || opcoes.sourcePath === undefined
    ? { content: fonte, diagnostics: [] as readonly Diagnostic[] }
    : await expandMarkdownComposition({
        sourcePath: opcoes.sourcePath,
        content: fonte,
        reader: {
          async read(path) {
            try { return await readFile(resolve(opcoes.baseDir!, path), 'utf8'); } catch { return undefined; }
          },
        },
      });
  const prepared = await compiler.prepare(snapshotDaFonte(composition.content, opcoes), opcoes.signal);
  const environment = await prepararAmbienteLocal(prepared, {
    ...(opcoes.baseDir !== undefined ? { baseDir: opcoes.baseDir } : {}),
    ...(opcoes.embutirRecursos !== undefined ? { embutirRecursos: opcoes.embutirRecursos } : {}),
    ...(opcoes.references !== undefined ? { references: opcoes.references } : {}),
    ...(opcoes.signal !== undefined ? { signal: opcoes.signal } : {}),
  });
  const result = await compiler.compile(
    {
      prepared,
      environment,
      ...(opcoes.perfil !== undefined ? { profileId: opcoes.perfil } : {}),
    },
    opcoes.signal,
  );

  return {
    ast: result.ast,
    resolvido: result.resolved,
    publicacao: result.publication,
    html: renderizarHtml(result.publication),
    validacao: result.validation,
    diagnosticos: [...composition.diagnostics, ...result.diagnostics],
  };
}
