import { protocolError, protocolOk, type ExportRequest, type ExportResultDto, type ExportService, type ProtocolResult } from '@abnt/protocol';
import { renderizarDocx } from '@abnt/renderer-docx';
import { renderizarHtml } from '@abnt/renderer-html';
import { gerarPdf } from '@abnt/renderer-pdf';

/**
 * Só transforma: recebe a Publication AST já resolvida e devolve bytes. Não
 * conhece o vault, não abre diálogo, não escreve arquivo — isso é papel do
 * Main, que tem o diálogo nativo de salvar. Isolado num processo próprio
 * porque o caminho de PDF sobe um Chromium de verdade via Puppeteer, e um
 * travamento ali não pode levar o Workspace Service (e o rascunho aberto)
 * junto. Ver ADR 0019.
 *
 * Separado de `entry.ts` para ser testável sem um utility process real de
 * verdade — mesmo motivo de `apps/lsp/src/create-server.ts` (P13).
 */
async function exportar(request: ExportRequest): Promise<ProtocolResult<ExportResultDto>> {
  if (request.format === 'docx') {
    const bytes = await renderizarDocx(request.publication);
    return protocolOk({ bytes: new Uint8Array(bytes) });
  }
  if (request.format === 'pdf') {
    const html = renderizarHtml(request.publication);
    const { bytes, paginas } = await gerarPdf(html);
    return protocolOk({ bytes, pages: paginas });
  }
  return protocolError('VALIDATION', `Formato de exportação desconhecido: ${String((request as { format: unknown }).format)}.`);
}

export function createExportService(): ExportService {
  return {
    async export(request, signal) {
      if (signal?.aborted === true) return protocolError('CANCELLED', 'Operação cancelada.');
      try {
        return await exportar(request);
      } catch (error) {
        return protocolError('INTERNAL', error instanceof Error ? error.message : 'Falha ao gerar o arquivo exportado.');
      }
    },
  };
}
