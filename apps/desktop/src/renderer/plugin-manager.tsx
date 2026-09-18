import { useEffect, useRef, useState, type JSX } from 'react';

import type { WorkspacePluginDto } from '@abnt/protocol';

import { useDialogAccessibility } from './dialog-accessibility.js';

/** F91/F93: superfície declarativa; nenhum componente ou código de plugin entra no renderer. */
export function PluginManagerDialog({ initialView, onClose, onChanged, onRunCommand }: {
  readonly initialView?: { readonly pluginId: string; readonly viewId: string };
  readonly onClose: () => void;
  readonly onChanged?: (plugins: readonly WorkspacePluginDto[]) => void;
  readonly onRunCommand: (pluginId: string, commandId: string) => void;
}): JSX.Element {
  const [plugins, setPlugins] = useState<readonly WorkspacePluginDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [view, setView] = useState<{ readonly title: string; readonly body: string }>();
  const dialog = useRef<HTMLElement>(null);
  useDialogAccessibility(dialog, onClose);

  const load = (): void => {
    setLoading(true); setError(undefined);
    void window.academic.workspace.plugins().then((result) => {
      if (result.ok) { setPlugins(result.value); onChanged?.(result.value); }
      else setError(result.error.message);
    }, () => setError('Não foi possível carregar os plugins locais.')).finally(() => setLoading(false));
  };
  useEffect(load, []);
  useEffect(() => {
    if (initialView === undefined) return;
    const plugin = plugins.find((item) => item.id === initialView.pluginId);
    const next = plugin?.views.find((item) => item.id === initialView.viewId);
    if (next !== undefined) setView(next);
  }, [initialView, plugins]);
  const toggle = (plugin: WorkspacePluginDto): void => {
    setError(undefined);
    void window.academic.workspace.setPluginEnabled({ id: plugin.id, enabled: !plugin.enabled }).then((result) => {
      if (result.ok) { setPlugins(result.value); onChanged?.(result.value); }
      else setError(result.error.message);
    }, () => setError('Não foi possível atualizar o plugin.'));
  };
  const reload = (): void => {
    setLoading(true); setError(undefined); setMessage(undefined);
    void window.academic.workspace.reloadPlugins().then((result) => {
      if (result.ok) { setPlugins(result.value); onChanged?.(result.value); setMessage('Plugins recarregados.'); }
      else setError(result.error.message);
    }, () => setError('Não foi possível recarregar os plugins locais.')).finally(() => setLoading(false));
  };

  return <div className="fixed inset-0 z-[58] grid place-items-center bg-slate-950/45 p-5" role="presentation">
    <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="plugins-title" aria-describedby="plugins-description" className="flex h-[min(80vh,48rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <header className="flex border-b border-slate-100 px-6 py-4">
        <div><h2 id="plugins-title" className="text-lg font-bold text-slate-900">Plugins locais</h2><p id="plugins-description" className="text-sm text-slate-600">Descobertos em <code>.academic/plugins</code>. Isolamento contém falhas, não é sandbox de segurança.</p></div>
        <button type="button" aria-label="Fechar plugins locais" className="folio-control ml-auto grid h-9 w-9 place-items-center rounded-lg text-xl" onClick={onClose}>×</button>
      </header>
      <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-3">
        <button type="button" disabled={loading} onClick={reload} className="folio-primary rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50">{loading ? 'Carregando…' : 'Recarregar'}</button>
        {message !== undefined && <span role="status" className="text-sm text-slate-600">{message}</span>}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-5">
        {loading ? <p role="status" className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Carregando plugins locais…</p> : error !== undefined ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"><p>{error}</p><button type="button" className="mt-3 rounded-lg border border-rose-300 px-3 py-1.5 font-semibold" onClick={load}>Tentar novamente</button></div> : <ul className="grid gap-3">{plugins.length === 0 ? <li className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Nenhum plugin local encontrado. Use Recarregar para instalar e descobrir a coleção oficial ou adicione um diretório em <code>.academic/plugins</code>.</li> : plugins.map((plugin) => <li key={plugin.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start gap-3"><div><strong className="text-slate-900">{plugin.id}</strong><span className="ml-2 text-xs text-slate-600">{plugin.version ?? 'manifesto inválido'}</span><p className="mt-1 text-xs text-slate-600">{plugin.capabilities.join(', ') || plugin.error || 'sem capabilities'}</p></div><button type="button" disabled={plugin.error !== undefined} onClick={() => toggle(plugin)} className="folio-control ml-auto rounded-lg px-3 py-1.5 text-sm font-semibold text-indigo-700 disabled:opacity-40">{plugin.enabled ? 'Desabilitar' : 'Habilitar'}</button></div>{plugin.error !== undefined && <p role="alert" className="mt-2 text-sm text-rose-700">{plugin.error}</p>}{plugin.commands.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{plugin.commands.map((command) => <button key={command.id} type="button" disabled={!plugin.enabled || plugin.error !== undefined} onClick={() => onRunCommand(plugin.id, command.id)} className="folio-primary rounded-lg px-3 py-1.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40">{command.title}</button>)}</div>}{plugin.views.map((item) => <button key={item.id} type="button" onClick={() => setView(item)} className="mt-3 mr-2 rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200">Sobre: {item.title}</button>)}</li>)}</ul>}
        {view !== undefined && <section className="mt-5 rounded-xl border border-indigo-200 bg-indigo-50 p-4"><div className="flex"><strong className="text-sm text-indigo-950">{view.title}</strong><button type="button" aria-label="Fechar detalhes do plugin" className="ml-auto" onClick={() => setView(undefined)}>×</button></div><p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{view.body}</p></section>}
      </div>
    </section>
  </div>;
}
