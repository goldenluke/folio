import type { MessagePortLike } from './model.js';

export type MessagePortUnsubscribe = () => void;

/**
 * Normaliza MessagePort de browser, Node e Electron para payload puro.
 * Node entrega o valor diretamente; Electron entrega `{ data }` pelo
 * EventEmitter; browser entrega MessageEvent pelo EventTarget.
 */
export function attachMessageListener(
  port: MessagePortLike,
  listener: (value: unknown) => void,
): MessagePortUnsubscribe {
  if (port.on !== undefined) {
    const emitterListener = (value: unknown) => {
      if (typeof value === 'object' && value !== null && 'data' in value) {
        listener((value as { readonly data: unknown }).data);
      } else {
        listener(value);
      }
    };
    port.on('message', emitterListener);
    port.start?.();
    return () => port.off?.('message', emitterListener);
  }

  if (port.addEventListener !== undefined) {
    const browserListener = (event: { readonly data: unknown }) => listener(event.data);
    port.addEventListener('message', browserListener);
    port.start?.();
    return () => port.removeEventListener?.('message', browserListener);
  }

  throw new Error('MessagePort não oferece um mecanismo de assinatura compatível.');
}
