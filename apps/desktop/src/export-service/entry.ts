import { serveExportOverMessagePort, type MessagePortLike } from '@abnt/protocol';

import { createExportService } from './service.js';

interface ParentPort {
  on(event: 'message', listener: (event: { readonly data?: unknown }) => void): void;
  off(event: 'message', listener: (event: { readonly data?: unknown }) => void): void;
  postMessage(value: unknown): void;
}

const parentPort = (process as NodeJS.Process & { readonly parentPort?: ParentPort }).parentPort;

if (parentPort === undefined) {
  throw new Error('O Export Service precisa ser iniciado por um host Electron utility process.');
}

const service = createExportService();
const listeners = new Map<(value: unknown) => void, (event: { readonly data?: unknown }) => void>();
const processPort: MessagePortLike = {
  postMessage: (value) => parentPort.postMessage(value),
  on: (_event, listener) => {
    const wrapped = (event: { readonly data?: unknown }) => listener(event.data);
    listeners.set(listener, wrapped);
    parentPort.on('message', wrapped);
  },
  off: (_event, listener) => {
    const wrapped = listeners.get(listener);
    if (wrapped === undefined) return;
    listeners.delete(listener);
    parentPort.off('message', wrapped);
  },
};
const unsubscribe = serveExportOverMessagePort(processPort, service);

process.once('disconnect', () => {
  unsubscribe();
});
