import { useEffect, useRef, useState, type JSX } from 'react';

import type { WorkspaceOpenResponse } from '@abnt/protocol';

import { useDialogAccessibility } from './dialog-accessibility.js';
import { requestConfirmation } from './text-prompt.js';

type VaultRecent = { readonly rootPath: string; readonly name: string; readonly lastOpenedAt: string };

export function VaultManagerDialog({ onClose, onOpened, onMessage }: {
  readonly onClose: () => void;
  readonly onOpened: (result: WorkspaceOpenResponse) => void;
  readonly onMessage: (message: string) => void;
}): JSX.Element {
  const [vaults, setVaults] = useState<readonly VaultRecent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const dialog = useRef<HTMLElement>(null);
  useDialogAccessibility(dialog, onClose);

  const load = (): void => {
    setLoading(true); setError(undefined);
    void window.academic.workspace.vaults().then((result) => {
      if (result.ok) setVaults(result.value); else setError(result.error.message);
    }, () => setError('Não foi possível carregar os vaults recentes.')).finally(() => setLoading(false));
  };
  useEffect(load, []);
  const open = async (rootPath?: string): Promise<void> => {
    setBusy(rootPath ?? 'choose'); setError(undefined);
    const result = rootPath === undefined ? await window.academic.workspace.chooseAndOpen() : await window.academic.workspace.open({ rootPath });
    setBusy(undefined);
    if (!result.ok) { if (result.error.code !== 'CANCELLED') setError(result.error.message); return; }
    onOpened(result.value); onClose();
  };
  const create = async (): Promise<void> => {
    setBusy('create'); setError(undefined);
    const result = await window.academic.workspace.createVault();
    setBusy(undefined);
    if (!result.ok) { if (result.error.code !== 'CANCELLED') setError(result.error.message); return; }
    onOpened(result.value); onMessage('Novo vault criado.'); onClose();
  };
  const forget = async (vault: VaultRecent): Promise<void> => {
    if (!await requestConfirmation({ title: 'Remover dos recentes?', description: `“${vault.name}” será apenas removido desta lista. Os arquivos do vault não serão alterados.`, confirmLabel: 'Remover atalho', destructive: false })) return;
    setBusy(vault.rootPath);
    const result = await window.academic.workspace.forgetVault(vault.rootPath);
    setBusy(undefined);
    if (!result.ok) { setError(result.error.message); return; }
    setVaults((current) => current.filter((item) => item.rootPath !== vault.rootPath));
  };

  return <div className="fixed inset-0 z-[65] grid place-items-center bg-slate-950/45 p-5" role="presentation">
    <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="vault-manager-title" aria-describedby="vault-manager-description" className="flex h-[min(78vh,42rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <header className="flex items-start border-b border-slate-100 px-6 py-5"><div><h2 id="vault-manager-title" className="text-lg font-bold text-slate-900">Gerenciar vaults</h2><p id="vault-manager-description" className="mt-1 text-sm text-slate-600">Abra um workspace recente, escolha outra pasta ou crie um vault acadêmico local.</p></div><button type="button" aria-label="Fechar gerenciador de vaults" className="folio-control ml-auto grid h-9 w-9 place-items-center rounded-lg text-xl" onClick={onClose}>×</button></header>
      <div className="flex flex-wrap gap-2 border-b border-slate-100 px-6 py-3"><button type="button" className="folio-primary rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50" disabled={busy !== undefined} onClick={() => void create()}>{busy === 'create' ? 'Criando…' : 'Criar vault'}</button><button type="button" className="folio-control rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50" disabled={busy !== undefined} onClick={() => void open()}>{busy === 'choose' ? 'Abrindo…' : 'Escolher pasta'}</button><button type="button" className="folio-control rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50" disabled={loading || busy !== undefined} onClick={load}>Atualizar</button></div>
      <div className="min-h-0 flex-1 overflow-auto p-5">{loading ? <p role="status" className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Carregando vaults recentes…</p> : error !== undefined ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"><p>{error}</p><button type="button" className="mt-3 rounded-lg border border-rose-300 px-3 py-1.5 font-semibold" onClick={load}>Tentar novamente</button></div> : vaults.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">Nenhum vault recente. Crie um vault ou escolha uma pasta existente para começar.</p> : <ul className="grid gap-3">{vaults.map((vault) => <li key={vault.rootPath} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start gap-3"><button type="button" className="min-w-0 flex-1 text-left" disabled={busy !== undefined} onClick={() => void open(vault.rootPath)}><strong className="block truncate text-slate-900">{vault.name}</strong><span className="mt-1 block truncate font-mono text-xs text-slate-600">{vault.rootPath}</span><span className="mt-1 block text-xs text-slate-500">Aberto em {new Date(vault.lastOpenedAt).toLocaleString()}</span></button><button type="button" aria-label={`Remover ${vault.name} dos recentes`} title="Remover dos recentes" className="folio-control rounded-lg px-3 py-2 text-sm text-slate-700 disabled:opacity-40" disabled={busy !== undefined} onClick={() => void forget(vault)}>{busy === vault.rootPath ? '…' : 'Remover'}</button></div></li>)}</ul>}</div>
    </section>
  </div>;
}
