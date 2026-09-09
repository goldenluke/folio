import type { DiagnosticDto, PublicationDocument, ResolvedDocumentDto } from '@abnt/protocol';

/** A versão do contrato de produto; manifestos incompatíveis nunca são ativados. */
export const FOLIO_PLUGIN_API_VERSION = 1;

export type FolioPluginCapability = 'lint' | 'commands' | 'views' | 'language-diagnostics' | 'export';

/** Painel declarativo: plugins não injetam componentes React no renderer. */
export interface FolioPluginViewContribution { readonly id: string; readonly title: string; readonly body: string; }
export interface FolioPluginCommandContribution { readonly id: string; readonly title: string; }
export interface FolioPluginExportContribution { readonly id: string; readonly title: string; readonly extension: string; readonly mimeType: string; }

/** Manifesto localizado em `.academic/plugins/<plugin>/plugin.json`. */
export interface FolioPluginManifest {
  readonly id: string;
  readonly version: string;
  readonly apiVersion: typeof FOLIO_PLUGIN_API_VERSION;
  readonly entry: string;
  readonly capabilities: readonly FolioPluginCapability[];
  readonly commands?: readonly FolioPluginCommandContribution[];
  readonly views?: readonly FolioPluginViewContribution[];
  readonly exports?: readonly FolioPluginExportContribution[];
}

export interface PluginCommandContext { readonly activeFileId?: string; readonly activeRevision?: number; }
export interface PluginCommandResult { readonly kind: 'notice' | 'open-view'; readonly message?: string; readonly viewId?: string; }
export interface PluginExportResult { readonly content: string; }

/**
 * Contrato que um plugin de lint de terceiros implementa. Só isso — o plugin
 * nunca importa `child_process`, nunca sabe que roda isolado. `runLintPlugin`
 * (`./runtime.js`) é a única ponte entre este objeto e o processo que o
 * hospeda (`@abnt/plugin-host`).
 *
 * Recebe `ResolvedDocumentDto`, a mesma projeção serializável que
 * `RegraDeValidacao` (built-in, `@abnt/standards`) recebe como
 * `ResolvedDocument` em memória — um plugin pode fazer qualquer coisa que uma
 * regra ABNT built-in faria, exceto mutar o documento: só lê, só devolve
 * diagnósticos. Ver ADR 0020.
 */
export interface AbntLintPluginInfo {
  readonly id: string;
  readonly version: string;
  /** Identidade da norma que o plugin fiscaliza, se houver uma (mesmo formato de `RegraDeValidacao.norma`). */
  readonly norma?: { readonly id: string; readonly version: string };
}

export interface AbntLintPlugin extends AbntLintPluginInfo {
  lint(document: ResolvedDocumentDto): readonly DiagnosticDto[] | Promise<readonly DiagnosticDto[]>;
}

/** API declarativa adicional à API de lint legada, sempre mediada pelo host. */
export interface FolioProductPlugin extends AbntLintPluginInfo {
  lint?(document: ResolvedDocumentDto): readonly DiagnosticDto[] | Promise<readonly DiagnosticDto[]>;
  command?(commandId: string, context: PluginCommandContext): PluginCommandResult | Promise<PluginCommandResult>;
  export?(exportId: string, publication: PublicationDocument): PluginExportResult | Promise<PluginExportResult>;
}

export const PLUGIN_PROTOCOL_VERSION = 1;

/** Anunciado pelo processo do plugin assim que sobe — antes disso, o host não manda pedido de lint algum. */
export interface PluginReadyMessage {
  readonly version: number;
  readonly type: 'abnt-plugin/ready';
  readonly plugin: AbntLintPluginInfo;
}

export interface PluginLintRequestMessage {
  readonly version: number;
  readonly type: 'abnt-plugin/lint';
  readonly requestId: string;
  readonly document: ResolvedDocumentDto;
}

export type PluginLintResponseMessage =
  | {
      readonly version: number;
      readonly type: 'abnt-plugin/lint-result';
      readonly requestId: string;
      readonly ok: true;
      readonly diagnostics: readonly DiagnosticDto[];
    }
  | {
      readonly version: number;
      readonly type: 'abnt-plugin/lint-result';
      readonly requestId: string;
      readonly ok: false;
      readonly error: string;
    };

export type PluginOutboundMessage = PluginReadyMessage | PluginLintResponseMessage;

export interface PluginCommandRequestMessage { readonly version: number; readonly type: 'abnt-plugin/command'; readonly requestId: string; readonly commandId: string; readonly context: PluginCommandContext; }
export type PluginCommandResponseMessage = { readonly version: number; readonly type: 'abnt-plugin/command-result'; readonly requestId: string; readonly ok: true; readonly result: PluginCommandResult } | { readonly version: number; readonly type: 'abnt-plugin/command-result'; readonly requestId: string; readonly ok: false; readonly error: string; };
export interface PluginExportRequestMessage { readonly version: number; readonly type: 'abnt-plugin/export'; readonly requestId: string; readonly exportId: string; readonly publication: PublicationDocument; }
export type PluginExportResponseMessage = { readonly version: number; readonly type: 'abnt-plugin/export-result'; readonly requestId: string; readonly ok: true; readonly result: PluginExportResult } | { readonly version: number; readonly type: 'abnt-plugin/export-result'; readonly requestId: string; readonly ok: false; readonly error: string; };
