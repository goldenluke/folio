import type { DiagnosticDto, ResolvedDocumentDto } from '@abnt/protocol';

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
