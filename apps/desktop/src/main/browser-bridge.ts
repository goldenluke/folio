import { createServer, type IncomingMessage, type Server } from 'node:http';

import { workspaceBrowserCaptureSchema, type WorkspaceBrowserCaptureDto } from '@abnt/protocol';

const MAX_CAPTURE_BYTES = 64 * 1024;

export const parseBrowserCapture = (value: unknown): WorkspaceBrowserCaptureDto | undefined => {
  const parsed = workspaceBrowserCaptureSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
};

const readBody = async (request: IncomingMessage): Promise<string> => new Promise((resolve, reject) => {
  let body = '';
  let size = 0;
  request.setEncoding('utf8');
  request.on('data', (chunk: string) => {
    size += Buffer.byteLength(chunk);
    if (size > MAX_CAPTURE_BYTES) {
      request.destroy();
      reject(new Error('Captura excede o limite.'));
      return;
    }
    body += chunk;
  });
  request.once('end', () => resolve(body));
  request.once('error', reject);
});

const answer = (response: import('node:http').ServerResponse, status: number, body: string): void => {
  response.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(body);
};

/**
 * Entrada local e sem autoridade: a extensão só pode entregar um DTO para o
 * renderer. A confirmação e qualquer escrita continuam sendo ações explícitas
 * da pessoa no desktop.
 */
export const startBrowserBridge = async (
  onCapture: (capture: WorkspaceBrowserCaptureDto) => void,
  port = 38_373,
): Promise<() => void> => {
  const server: Server = createServer(async (request, response) => {
    if (request.method !== 'POST' || request.url !== '/capture') {
      answer(response, 404, JSON.stringify({ ok: false }));
      return;
    }
    try {
      const body = await readBody(request);
      const capture = parseBrowserCapture(JSON.parse(body));
      if (capture === undefined) {
        answer(response, 400, JSON.stringify({ ok: false, error: 'Captura inválida.' }));
        return;
      }
      onCapture(capture);
      answer(response, 202, JSON.stringify({ ok: true }));
    } catch {
      answer(response, 400, JSON.stringify({ ok: false, error: 'Captura inválida.' }));
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  return () => { server.close(); };
};
