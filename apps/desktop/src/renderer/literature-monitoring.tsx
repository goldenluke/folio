import { useEffect, useState, type JSX } from 'react';

import type { LiteratureFeedInboxItemDto, LiteratureSubscriptionDto } from '@abnt/protocol';

import { readResearchProjects, writeResearchProjects } from './research-projects.js';

/** Mesma chave/forma de `folio.reading-queue:{workspaceId}` que research-workflow.tsx já usa (preferência local, sem protocolo). */
const markToRead = (workspaceId: string, referenceId: string): void => {
  try {
    const key = `folio.reading-queue:${workspaceId}`;
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? '{}');
    const current = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    window.localStorage.setItem(key, JSON.stringify({ ...current, [referenceId]: { state: 'to-read', updatedAt: new Date().toISOString() } }));
  } catch { /* preferência local; falha aqui não deve travar a importação */ }
};

const addReferenceToProject = (workspaceId: string, projectId: string, referenceId: string): void => {
  const projects = readResearchProjects(workspaceId);
  writeResearchProjects(workspaceId, projects.map((project) => project.id === projectId && !project.referenceIds.includes(referenceId)
    ? { ...project, referenceIds: [...project.referenceIds, referenceId], updatedAt: new Date().toISOString() }
    : project));
};

export function LiteratureMonitoringDialog({ workspaceId, onClose, onMessage }: {
  readonly workspaceId: string;
  readonly onClose: () => void;
  readonly onMessage: (message: string) => void;
}): JSX.Element {
  const [subscriptions, setSubscriptions] = useState<readonly LiteratureSubscriptionDto[]>([]);
  const [items, setItems] = useState<readonly LiteratureFeedInboxItemDto[]>([]);
  const [projects] = useState(() => readResearchProjects(workspaceId).filter((project) => project.archivedAt === undefined));
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const [keywordsText, setKeywordsText] = useState('');
  const [busyId, setBusyId] = useState<string | undefined>(undefined);

  const load = (): void => {
    void window.academic.workspace.literatureSubscriptions().then((result) => { if (result.ok) setSubscriptions(result.value.subscriptions); });
    void window.academic.workspace.literatureFeedInbox().then((result) => { if (result.ok) setItems(result.value.items); });
  };
  useEffect(load, []);

  const titleForSubscription = (subscriptionId: string): string => subscriptions.find((subscription) => subscription.id === subscriptionId)?.title ?? subscriptionId;

  const addSubscription = async (): Promise<void> => {
    if (url.trim() === '' || title.trim() === '') return;
    const keywords = keywordsText.split(',').map((keyword) => keyword.trim()).filter((keyword) => keyword !== '');
    const result = await window.academic.workspace.addLiteratureSubscription({
      url: url.trim(), title: title.trim(), ...(projectId === undefined ? {} : { projectId }), ...(keywords.length === 0 ? {} : { keywords }),
    });
    if (!result.ok) { onMessage(result.error.message); return; }
    setUrl(''); setTitle(''); setKeywordsText('');
    load();
  };
  const removeSubscription = async (id: string): Promise<void> => {
    const result = await window.academic.workspace.removeLiteratureSubscription({ id });
    if (!result.ok) { onMessage(result.error.message); return; }
    load();
  };
  const poll = async (id: string): Promise<void> => {
    setBusyId(id);
    const result = await window.academic.workspace.pollLiteratureSubscription({ id });
    setBusyId(undefined);
    if (!result.ok) { onMessage(result.error.message); return; }
    onMessage(result.value.added === 0 ? 'Nenhum item novo.' : `${result.value.added} item(ns) novo(s) no inbox.`);
    load();
  };
  const dismiss = async (id: string): Promise<void> => {
    const result = await window.academic.workspace.dismissFeedInboxItem({ id });
    if (!result.ok) { onMessage(result.error.message); return; }
    load();
  };
  const importItem = async (item: LiteratureFeedInboxItemDto): Promise<void> => {
    const result = await window.academic.workspace.importFeedInboxItem({ id: item.id });
    if (!result.ok) { onMessage(result.error.message); return; }
    markToRead(workspaceId, result.value.id);
    const subscription = subscriptions.find((entry) => entry.id === item.subscriptionId);
    if (subscription?.projectId !== undefined) addReferenceToProject(workspaceId, subscription.projectId, result.value.id);
    onMessage(`Referência ${result.value.id} criada e marcada para leitura.`);
    load();
  };

  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-5" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="literature-monitoring-title" className="grid h-[min(86vh,54rem)] w-full max-w-4xl grid-cols-[18rem_1fr] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
    <aside className="overflow-auto border-r border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center"><h2 id="literature-monitoring-title" className="font-bold text-slate-900">Monitoramento</h2><button type="button" className="ml-auto text-lg text-slate-500" onClick={onClose}>×</button></div>
      <ul className="mt-3 grid gap-2">{subscriptions.length === 0 ? <li className="text-sm text-slate-500">Nenhuma assinatura.</li> : subscriptions.map((subscription) => <li key={subscription.id} className="rounded-lg border border-slate-200 bg-white p-2 text-sm"><strong className="block truncate">{subscription.title}</strong><span className="block truncate text-xs text-slate-500">{subscription.url}</span>{subscription.keywords !== undefined && subscription.keywords.length > 0 && <span className="mt-1 block text-xs text-indigo-600">{subscription.keywords.join(', ')}</span>}<div className="mt-2 flex gap-2"><button type="button" disabled={busyId === subscription.id} className="rounded bg-indigo-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-40" onClick={() => void poll(subscription.id)}>{busyId === subscription.id ? 'Buscando…' : 'Buscar agora'}</button><button type="button" className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-rose-600" onClick={() => void removeSubscription(subscription.id)}>Remover</button></div></li>)}</ul>
      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nova assinatura</p>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título" className="mt-2 w-full rounded border border-slate-300 px-2 py-1 text-sm" />
        <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="URL do feed (RSS/Atom)" className="mt-2 w-full rounded border border-slate-300 px-2 py-1 text-sm" />
        <input value={keywordsText} onChange={(event) => setKeywordsText(event.target.value)} placeholder="Palavras-chave (opcional, separadas por vírgula)" className="mt-2 w-full rounded border border-slate-300 px-2 py-1 text-sm" />
        {projects.length > 0 && <select aria-label="Projeto" value={projectId ?? ''} onChange={(event) => setProjectId(event.target.value === '' ? undefined : event.target.value)} className="mt-2 w-full rounded border border-slate-300 px-2 py-1 text-sm"><option value="">Sem projeto</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select>}
        <button type="button" disabled={url.trim() === '' || title.trim() === ''} className="folio-primary mt-2 w-full rounded px-2 py-1.5 text-sm font-semibold disabled:opacity-40" onClick={() => void addSubscription()}>Adicionar</button>
      </div>
    </aside>
    <div className="overflow-auto p-5">
      <h3 className="text-sm font-bold text-slate-800">Inbox ({items.length})</h3>
      <p className="mt-1 text-xs text-slate-500">Nenhum item entra na biblioteca sozinho — revise e importe.</p>
      <ul className="mt-3 grid gap-3">{items.length === 0 ? <li className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Nenhum item pendente.</li> : items.map((item) => <li key={item.id} className="rounded-lg border border-slate-200 p-3"><span className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{titleForSubscription(item.subscriptionId)}</span><a href={item.link} className="mt-1 block truncate text-sm font-semibold text-slate-800">{item.title}</a>{item.summary !== undefined && <p className="mt-1 line-clamp-3 text-xs text-slate-600">{item.summary}</p>}<div className="mt-2 flex gap-2"><button type="button" className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white" onClick={() => void importItem(item)}>Importar</button><button type="button" className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600" onClick={() => void dismiss(item.id)}>Descartar</button></div></li>)}</ul>
    </div>
  </section></div>;
}
