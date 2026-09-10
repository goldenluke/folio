import { useEffect, useRef, useState, type JSX } from 'react';

import { useDialogAccessibility } from './dialog-accessibility.js';

interface TextPromptOptions {
  readonly description?: string;
  readonly placeholder?: string;
}

interface TextPromptRequest extends TextPromptOptions {
  readonly id: number;
  readonly title: string;
  readonly defaultValue: string;
  readonly resolve: (value: string | null) => void;
}

interface ConfirmationRequest {
  readonly id: number;
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly destructive: boolean;
  readonly resolve: (confirmed: boolean) => void;
}

let showTextPrompt: ((title: string, defaultValue: string, options: TextPromptOptions) => Promise<string | null>) | undefined;
let showConfirmation: ((options: Omit<ConfirmationRequest, 'id' | 'resolve'>) => Promise<boolean>) | undefined;
let nextRequestId = 0;

/** Electron não implementa window.prompt() (lança "prompt() is not supported"); todo input de texto do app passa por aqui. */
export function requestText(title: string, defaultValue = '', options: TextPromptOptions = {}): Promise<string | null> {
  if (showTextPrompt === undefined) return Promise.resolve(null);
  return showTextPrompt(title, defaultValue, options);
}

/** Confirmações destrutivas passam por uma UI acessível e não pelo diálogo nativo. */
export function requestConfirmation(options: { readonly title: string; readonly description: string; readonly confirmLabel?: string; readonly destructive?: boolean }): Promise<boolean> {
  if (showConfirmation === undefined) return Promise.resolve(false);
  return showConfirmation({ ...options, confirmLabel: options.confirmLabel ?? 'Confirmar', destructive: options.destructive ?? true });
}

function TextPromptDialog({ title, description, defaultValue, placeholder, onSubmit, onCancel }: {
  readonly title: string;
  readonly description?: string;
  readonly defaultValue: string;
  readonly placeholder?: string;
  readonly onSubmit: (value: string) => void;
  readonly onCancel: () => void;
}): JSX.Element {
  const [value, setValue] = useState(defaultValue);
  const dialog = useRef<HTMLFormElement>(null);
  useDialogAccessibility(dialog, onCancel);
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/40 p-5" role="presentation" onClick={onCancel}>
    <form ref={dialog} role="dialog" aria-modal="true" aria-labelledby="text-prompt-title" className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); onSubmit(value); }}>
      <h2 id="text-prompt-title" className="text-base font-bold text-slate-900">{title}</h2>
      {description !== undefined && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      <input
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        {...(placeholder !== undefined ? { placeholder } : {})}
        className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none"
      />
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="folio-control rounded-lg px-3 py-2 text-sm font-semibold" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="folio-primary rounded-lg px-3 py-2 text-sm font-semibold">OK</button>
      </div>
    </form>
  </div>;
}

function ConfirmationDialog({ request, onClose }: { readonly request: ConfirmationRequest; readonly onClose: (confirmed: boolean) => void }): JSX.Element {
  const dialog = useRef<HTMLDivElement>(null);
  useDialogAccessibility(dialog, () => onClose(false));
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/40 p-5" role="presentation" onClick={() => onClose(false)}>
    <div ref={dialog} role="alertdialog" aria-modal="true" aria-labelledby="confirmation-title" aria-describedby="confirmation-description" className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
      <h2 id="confirmation-title" className="text-base font-bold text-slate-900">{request.title}</h2>
      <p id="confirmation-description" className="mt-2 text-sm text-slate-600">{request.description}</p>
      <div className="mt-5 flex justify-end gap-2"><button type="button" className="folio-control rounded-lg px-3 py-2 text-sm font-semibold" onClick={() => onClose(false)}>Cancelar</button><button type="button" className={`${request.destructive ? 'bg-rose-700 hover:bg-rose-800' : 'folio-primary'} rounded-lg px-3 py-2 text-sm font-semibold text-white`} onClick={() => onClose(true)}>{request.confirmLabel}</button></div>
    </div>
  </div>;
}

/** Único host montado pelo App; requestText() funciona de qualquer componente sem prop drilling. */
export function TextPromptHost(): JSX.Element | null {
  const [request, setRequest] = useState<TextPromptRequest | undefined>(undefined);
  const [confirmation, setConfirmation] = useState<ConfirmationRequest | undefined>(undefined);
  useEffect(() => {
    // Chamadas em sequência (ex.: figure.insert pede alt, legenda, fonte e
    // identificador, uma após a outra) podem fazer o React aplicar o
    // setRequest(undefined) do pedido anterior e o setRequest(novo) do
    // próximo no mesmo batch, sem nunca desmontar o diálogo entre os dois.
    // Sem uma key que mude a cada pedido, TextPromptDialog continua montado
    // e seu useState(defaultValue) nunca reinicializa — o campo mostra o
    // valor deixado pelo pedido anterior em vez do novo default.
    showTextPrompt = (title, defaultValue, options) => new Promise((resolve) => setRequest({ id: (nextRequestId += 1), title, defaultValue, resolve, ...options }));
    showConfirmation = (options) => new Promise((resolve) => setConfirmation({ id: (nextRequestId += 1), resolve, ...options }));
    return () => { showTextPrompt = undefined; showConfirmation = undefined; };
  }, []);
  if (request !== undefined) return <TextPromptDialog
    key={request.id}
    title={request.title}
    {...(request.description !== undefined ? { description: request.description } : {})}
    defaultValue={request.defaultValue}
    {...(request.placeholder !== undefined ? { placeholder: request.placeholder } : {})}
    onSubmit={(value) => { request.resolve(value); setRequest(undefined); }}
    onCancel={() => { request.resolve(null); setRequest(undefined); }}
  />;
  if (confirmation !== undefined) return <ConfirmationDialog request={confirmation} onClose={(confirmed) => { confirmation.resolve(confirmed); setConfirmation(undefined); }} />;
  return null;
}
