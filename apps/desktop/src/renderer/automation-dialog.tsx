import { useMemo, useState, type JSX } from 'react';

import type { WorkspaceFileDto } from '@abnt/protocol';

import { executeAutomation, planAutomation, type WorkspaceMacro } from './shell/automation.js';
import type { CommandContext, CommandRegistry } from './shell/commands.js';
import { keybindingConflict, mergeKeybindings, normalizeChord, type CustomKeybindings, type KeyBindingMap } from './shell/keybindings.js';
import { requestConfirmation, requestText } from './text-prompt.js';

type Collection = { readonly id: string; readonly name: string };

export function AutomationDialog({ registry, context, files, collections, macros, onMacrosChange, defaultKeybindings, customKeybindings, onCustomKeybindingsChange, onClose, onMessage }: {
  readonly registry: CommandRegistry;
  readonly context: CommandContext;
  readonly files: readonly WorkspaceFileDto[];
  readonly collections: readonly Collection[];
  readonly macros: readonly WorkspaceMacro[];
  readonly onMacrosChange: (value: readonly WorkspaceMacro[]) => void;
  readonly defaultKeybindings: KeyBindingMap;
  readonly customKeybindings: CustomKeybindings;
  readonly onCustomKeybindingsChange: (value: CustomKeybindings) => void;
  readonly onClose: () => void;
  readonly onMessage: (message: string) => void;
}): JSX.Element {
  const [selectedFileIds, setSelectedFileIds] = useState<readonly string[]>([]);
  const [collectionId, setCollectionId] = useState('');
  const [newChord, setNewChord] = useState('');
  const [commandId, setCommandId] = useState('');
  const bindings = useMemo(() => mergeKeybindings(defaultKeybindings, customKeybindings), [defaultKeybindings, customKeybindings]);
  const eligible = useMemo(() => registry.list().filter((command) => !command.id.startsWith('macro.') && (() => {
    try { return registry.automationPreview(command.id, context) !== undefined; } catch { return false; }
  })()), [context, registry]);

  const setMacros = (update: readonly WorkspaceMacro[] | ((current: readonly WorkspaceMacro[]) => readonly WorkspaceMacro[])): void => onMacrosChange(typeof update === 'function' ? update(macros) : update);
  const selectedFiles = files.filter((file) => selectedFileIds.includes(file.fileId)).map((file) => ({ fileId: file.fileId, path: file.path }));
  const batchContext: CommandContext = { ...context, selectedFiles };
  const run = async (commands: WorkspaceMacro['commands']): Promise<void> => {
    try {
      const plan = planAutomation(registry, batchContext, commands);
      const description = plan.steps.map((step) => `• ${step.preview.summary}`).join('\n');
      if (plan.requiresConfirmation && !await requestConfirmation({ title: 'Executar automação?', description, confirmLabel: 'Executar', destructive: false })) return;
      await executeAutomation(registry, batchContext, plan);
      onMessage(`Automação concluída: ${plan.steps.length} comando(s).`);
    } catch (error) { onMessage(error instanceof Error ? error.message : 'Não foi possível executar a automação.'); }
  };
  const addMacro = async (): Promise<void> => {
    const name = await requestText('Nome da macro', 'Preparar submissão');
    if (name === null || name.trim() === '') return;
    setMacros((current) => [...current, { id: crypto.randomUUID(), name: name.trim(), commands: [] }]);
  };
  const addStep = (macroId: string, step: string): void => setMacros((current) => current.map((macro) => macro.id !== macroId ? macro : { ...macro, commands: [...macro.commands, { commandId: step }] }));
  const assignKeybinding = async (): Promise<void> => {
    const chord = normalizeChord(newChord);
    if (chord === undefined || commandId === '') { onMessage('Informe um atalho e um comando válidos.'); return; }
    const conflict = keybindingConflict(bindings, chord, commandId);
    if (conflict !== undefined && !await requestConfirmation({ title: 'Substituir atalho?', description: `${chord} já executa ${conflict}.`, confirmLabel: 'Substituir', destructive: false })) return;
    onCustomKeybindingsChange({ ...customKeybindings, [chord]: commandId });
    setNewChord(''); onMessage(`Atalho ${chord} atribuído a ${commandId}.`);
  };

  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-5"><section role="dialog" aria-modal="true" aria-labelledby="automation-title" className="grid max-h-[86vh] w-full max-w-5xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"><header className="flex items-start border-b border-slate-200 px-6 py-5"><div><h2 id="automation-title" className="text-lg font-bold text-slate-900">Automação e atalhos</h2><p className="mt-0.5 text-sm text-slate-500">Macros locais executam apenas commands registrados; não aceitam JavaScript, shell ou callbacks.</p></div><button type="button" className="folio-control ml-auto grid h-9 w-9 place-items-center rounded-lg text-xl" onClick={onClose}>×</button></header><div className="grid min-h-0 gap-6 overflow-auto p-6 lg:grid-cols-2">
    <section className="grid content-start gap-4"><div className="flex items-center justify-between"><div><h3 className="font-semibold">Macros</h3><p className="text-sm text-slate-500">Chains sequenciais com prévia antes de comandos que escrevem ou exportam.</p></div><button type="button" className="folio-primary rounded-lg px-3 py-2 text-sm font-semibold" onClick={addMacro}>Nova macro</button></div>{macros.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">Crie “Preparar submissão” e adicione Salvar, Visualizar publicação e Exportar PDF.</p>}<ul className="grid gap-3">{macros.map((macro) => <li key={macro.id} className="rounded-xl border border-slate-200 p-4"><div className="flex gap-3"><strong className="flex-1">{macro.name}</strong><button type="button" className="text-sm font-semibold text-indigo-700" disabled={macro.commands.length === 0} onClick={() => void run(macro.commands)}>Prévia e executar</button><button type="button" className="text-sm text-rose-600" onClick={() => setMacros((current) => current.filter((item) => item.id !== macro.id))}>Remover</button></div><ol className="mt-3 grid gap-1 text-sm text-slate-600">{macro.commands.map((step, index) => <li key={`${step.commandId}:${index}`} className="flex gap-2"><span>{index + 1}.</span><span className="flex-1">{registry.list().find((command) => command.id === step.commandId)?.title ?? step.commandId}</span><button type="button" className="text-rose-600" onClick={() => setMacros((current) => current.map((item) => item.id !== macro.id ? item : { ...item, commands: item.commands.filter((_command, position) => position !== index) }))}>×</button></li>)}</ol><select aria-label={`Adicionar comando à macro ${macro.name}`} className="mt-3 w-full rounded border border-slate-300 p-2 text-sm" value="" onChange={(event) => { if (event.target.value !== '') addStep(macro.id, event.target.value); }}><option value="">Adicionar command…</option>{eligible.map((command) => <option key={command.id} value={command.id}>{command.title}</option>)}</select></li>)}</ul></section>
    <section className="grid content-start gap-5"><div><h3 className="font-semibold">Operação em lote</h3><p className="text-sm text-slate-500">Selecione alvos primeiro; a ação recebe FileIds, não paths soltos.</p><div className="mt-3 max-h-40 overflow-auto rounded-lg border border-slate-200 p-2">{files.map((file) => <label key={file.fileId} className="flex gap-2 p-1 text-sm"><input type="checkbox" checked={selectedFileIds.includes(file.fileId)} onChange={() => setSelectedFileIds((current) => current.includes(file.fileId) ? current.filter((id) => id !== file.fileId) : [...current, file.fileId])} />{file.path}</label>)}</div><div className="mt-3 flex gap-2"><select aria-label="Collection de destino" className="min-w-0 flex-1 rounded border border-slate-300 p-2 text-sm" value={collectionId} onChange={(event) => setCollectionId(event.target.value)}><option value="">Adicionar à collection…</option>{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select><button type="button" className="rounded-lg border border-indigo-200 px-3 text-sm font-semibold text-indigo-700" disabled={selectedFiles.length === 0 || collectionId === ''} onClick={() => void run([{ commandId: 'batch.addToCollection', args: { collectionId } }])}>Prévia</button></div><button type="button" className="mt-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold" disabled={selectedFiles.length === 0} onClick={() => void run([{ commandId: 'batch.validateDocuments' }])}>Validar documentos selecionados</button></div>
      <div><h3 className="font-semibold">Atalhos personalizados</h3><p className="text-sm text-slate-500">Preferência local. Conflitos exigem confirmação; não há sobrescrita silenciosa.</p><div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]"><input value={newChord} onChange={(event) => setNewChord(event.target.value)} placeholder="mod+alt+p" className="rounded border border-slate-300 p-2 text-sm" /><select value={commandId} onChange={(event) => setCommandId(event.target.value)} className="rounded border border-slate-300 p-2 text-sm"><option value="">Command…</option>{registry.list().map((command) => <option key={command.id} value={command.id}>{command.title}</option>)}</select><button type="button" className="rounded-lg border border-indigo-200 px-3 text-sm font-semibold text-indigo-700" onClick={assignKeybinding}>Atribuir</button></div><ul className="mt-3 max-h-32 overflow-auto text-sm text-slate-600">{[...bindings.entries()].map(([chord, id]) => <li key={chord} className="flex gap-2 py-1"><code>{chord}</code><span>→ {id}</span>{customKeybindings[chord] !== undefined && <button type="button" className="ml-auto text-rose-600" onClick={() => { const next = { ...customKeybindings }; delete next[chord]; onCustomKeybindingsChange(next); }}>Restaurar</button>}</li>)}</ul></div>
    </section>
  </div></section></div>;
}
