import { useEffect, useMemo, useRef, useState, type JSX } from 'react';

import type { DiagnosticDto, EditorOutlineItemDto, LanguageWritingStatisticsDto } from '@abnt/protocol';

type Goals = { readonly documentWords: number; readonly dailyWords: number; readonly sections: Readonly<Record<string, number>> };
const defaultGoals: Goals = { documentWords: 5_000, dailyWords: 500, sections: {} };

const normalize = (value: string): string => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase().trim();
const expectedByProfile: Readonly<Record<string, readonly string[]>> = {
  'abnt-artigo': ['Resumo', 'Introdução', 'Desenvolvimento', 'Considerações finais', 'Referências'],
  'abnt-artigo-numerico': ['Resumo', 'Introdução', 'Desenvolvimento', 'Considerações finais', 'Referências'],
  'abnt-tcc': ['Introdução', 'Fundamentação teórica', 'Metodologia', 'Resultados e discussão', 'Considerações finais', 'Referências'],
  'web-article': [],
};

const loadGoals = (workspaceId: string, fileId: string): Goals => {
  try {
    const data: unknown = JSON.parse(window.localStorage.getItem(`folio.writing-goals:${workspaceId}:${fileId}`) ?? 'null');
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return defaultGoals;
    const candidate = data as Partial<Goals>;
    return {
      documentWords: typeof candidate.documentWords === 'number' && candidate.documentWords >= 0 ? candidate.documentWords : defaultGoals.documentWords,
      dailyWords: typeof candidate.dailyWords === 'number' && candidate.dailyWords >= 0 ? candidate.dailyWords : defaultGoals.dailyWords,
      sections: typeof candidate.sections === 'object' && candidate.sections !== null ? candidate.sections : {},
    };
  } catch { return defaultGoals; }
};

const percent = (current: number, target: number): number => target <= 0 ? 0 : Math.min(100, Math.round((current / target) * 100));
const diagnosticFor = (diagnostics: readonly DiagnosticDto[], ids: readonly string[]): DiagnosticDto | undefined => diagnostics.find((diagnostic) => ids.some((id) => diagnostic.id === id || diagnostic.id.startsWith(id)));

function Progress({ current, target, label }: { readonly current: number; readonly target: number; readonly label: string }): JSX.Element {
  const value = percent(current, target);
  return <div>
    <div className="mb-1 flex justify-between gap-3 text-xs"><span className="truncate text-slate-600">{label}</span><strong className="shrink-0 text-slate-800">{current.toLocaleString('pt-BR')} / {target.toLocaleString('pt-BR')}</strong></div>
    <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500 transition-[width]" style={{ width: `${value}%` }} /></div>
    <span className="mt-1 block text-[11px] text-slate-500">{value}%</span>
  </div>;
}

export function WritingWorkflowDialog({ workspaceId, fileId, profileId, outline, diagnostics, statistics, onClose, onNavigate }: { readonly workspaceId: string; readonly fileId: string; readonly profileId: string; readonly outline: readonly EditorOutlineItemDto[]; readonly diagnostics: readonly DiagnosticDto[]; readonly statistics: LanguageWritingStatisticsDto; readonly onClose: () => void; readonly onNavigate: (offset: number) => void }): JSX.Element {
  const [tab, setTab] = useState<'structure' | 'requirements' | 'goals' | 'session'>('structure');
  const [goals, setGoals] = useState<Goals>(() => loadGoals(workspaceId, fileId));
  const baseline = useRef<{ readonly words: number; readonly citations: number; readonly startedAt: number } | undefined>(undefined);
  const [, setNow] = useState(Date.now());
  if (baseline.current === undefined) baseline.current = { words: statistics.words, citations: statistics.citations, startedAt: Date.now() };
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { window.localStorage.setItem(`folio.writing-goals:${workspaceId}:${fileId}`, JSON.stringify(goals)); }, [goals, workspaceId, fileId]);
  const expected = expectedByProfile[profileId] ?? [];
  const requirementRows = useMemo(() => {
    const tcc = profileId === 'abnt-tcc';
    const profileRows: readonly (readonly [string, readonly string[]])[] = tcc
      ? [['Título, autoria e orientação', ['ABNT-14724-EST-001', 'ABNT-14724-EST-002', 'ABNT-14724-EST-003']], ['Instituição, natureza, local e ano', ['ABNT-14724-EST-004', 'ABNT-14724-EST-005', 'ABNT-14724-EST-006', 'ABNT-14724-EST-007']], ['Resumo e palavras-chave', ['ABNT-6028-TCC-001', 'ABNT-6028-TCC-002', 'ABNT-6028-TCC-003', 'ABNT-6028-TCC-004']]]
      : [['Resumo dentro do limite do perfil', ['ABNT-6028-RES-001']]];
    const commonRows: readonly (readonly [string, readonly string[]])[] = [
      ...profileRows,
      ['Referências resolvidas', ['ABNT-6023-REF-001', 'CIT-REF-AUSENTE']],
      ['Figuras e tabelas identificadas', ['ABNT-6022-FIG', 'ABNT-6022-TAB']],
    ];
    return commonRows;
  }, [profileId]);
  const session = baseline.current;
  const elapsed = Math.max(0, Math.round((Date.now() - session.startedAt) / 60_000));
  const addedWords = Math.max(0, statistics.words - session.words);
  const addedCitations = Math.max(0, statistics.citations - session.citations);
  const updateGoal = (field: 'documentWords' | 'dailyWords', value: string): void => setGoals((current) => ({ ...current, [field]: Math.max(0, Number(value) || 0) }));
  const updateSectionGoal = (title: string, value: string): void => setGoals((current) => ({ ...current, sections: { ...current.sections, [title]: Math.max(0, Number(value) || 0) } }));

  const content = tab === 'structure' ? <>
    <p className="text-sm text-slate-600">Perfil atual: <strong>{profileId}</strong>. O checklist é uma orientação do profile, não uma alteração do documento.</p>
    {expected.length === 0 ? <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Este profile não declara uma estrutura acadêmica obrigatória.</p> : <ul className="mt-5 grid gap-2">{expected.map((title) => {
      const found = outline.find((item) => normalize(item.title).includes(normalize(title)));
      return <li key={title} className={`flex items-center gap-3 rounded-xl border p-3 ${found === undefined ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
        <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${found === undefined ? 'bg-amber-200 text-amber-900' : 'bg-emerald-200 text-emerald-900'}`}>{found === undefined ? '!' : '✓'}</span>
        <div className="min-w-0 flex-1"><strong className="block text-sm text-slate-800">{title}</strong><span className="text-xs text-slate-500">{found === undefined ? 'Seção ainda não encontrada' : `Encontrada como “${found.title}”`}</span></div>
        {found !== undefined && <button type="button" className="text-xs font-semibold text-indigo-700" onClick={() => onNavigate(found.range.start)}>Ir para seção</button>}
      </li>;
    })}</ul>}
  </> : tab === 'requirements' ? <ul className="grid gap-3">{requirementRows.map(([label, ids]) => {
    const problem = diagnosticFor(diagnostics, ids);
    return <li key={label} className={`rounded-xl border p-4 ${problem === undefined ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
      <div className="flex gap-3"><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${problem === undefined ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'}`}>{problem === undefined ? '✓' : '!'}</span><div className="min-w-0 flex-1"><strong className="block text-sm text-slate-800">{label}</strong>{problem === undefined ? <span className="mt-1 block text-xs text-emerald-800">Nenhum diagnóstico relacionado no snapshot atual.</span> : <button type="button" className="mt-1 text-left text-xs text-amber-900 hover:underline" onClick={() => onNavigate(problem.source?.start.offset ?? 0)}>{problem.message} <span className="font-mono">{problem.id}</span></button>}</div></div>
    </li>;
  })}</ul> : tab === 'goals' ? <div className="grid gap-6">
    <section className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2"><label className="grid gap-1 text-sm font-medium text-slate-700">Meta do documento<input type="number" min="0" value={goals.documentWords} onChange={(event) => updateGoal('documentWords', event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 font-normal outline-none focus:border-indigo-400" /></label><label className="grid gap-1 text-sm font-medium text-slate-700">Meta diária (sessão local)<input type="number" min="0" value={goals.dailyWords} onChange={(event) => updateGoal('dailyWords', event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 font-normal outline-none focus:border-indigo-400" /></label></section>
    <div className="grid gap-4"><Progress label="Documento" current={statistics.words} target={goals.documentWords} /><Progress label="Produção nesta sessão" current={addedWords} target={goals.dailyWords} /></div>
    <section><h3 className="text-sm font-bold text-slate-800">Resumo e capítulos</h3><p className="mt-1 text-xs text-slate-500">Metas locais por seção; a contagem vem da language-service revisionada.</p><div className="mt-3 grid gap-3">{statistics.sections.map((section) => <div key={section.title} className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[minmax(0,1fr)_9rem]"><div><strong className="block text-sm text-slate-800">{section.title}</strong><span className="text-xs text-slate-500">{section.words.toLocaleString('pt-BR')} palavras</span></div><label className="grid gap-1 text-xs text-slate-500">Meta<input type="number" min="0" value={goals.sections[section.title] ?? 0} onChange={(event) => updateSectionGoal(section.title, event.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-indigo-400" /></label>{(goals.sections[section.title] ?? 0) > 0 && <div className="sm:col-span-2"><Progress label={section.title} current={section.words} target={goals.sections[section.title] ?? 0} /></div>}</div>)}</div></section>
  </div> : <div className="grid gap-4">
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{([['Palavras', addedWords], ['Citações', addedCitations], ['Minutos', elapsed], ['Total atual', statistics.words]] as const).map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span><strong className="mt-2 block text-2xl text-slate-800">{value.toLocaleString('pt-BR')}</strong></div>)}</div>
    <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-600"><strong className="text-slate-800">Sessão local iniciada ao abrir este painel.</strong><p className="mt-1">O progresso compara a projeção revisionada atual com o início da sessão. Não escreve histórico no documento nem no índice SQLite.</p></div>
    <Progress label="Meta de produção da sessão" current={addedWords} target={goals.dailyWords} />
  </div>;

  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-5"><section role="dialog" aria-modal="true" aria-labelledby="writing-workflow-title" className="flex h-[min(82vh,52rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20"><header className="flex items-start border-b border-slate-200 px-6 py-5"><div><h2 id="writing-workflow-title" className="text-lg font-bold text-slate-900">Escrita acadêmica</h2><p className="mt-0.5 text-sm text-slate-500">Estrutura, requisitos, metas e progresso são projeções — seu Markdown continua soberano.</p></div><button type="button" aria-label="Fechar" className="folio-control ml-auto grid h-9 w-9 place-items-center rounded-lg text-xl" onClick={onClose}>×</button></header><nav className="flex flex-wrap gap-x-5 border-b border-slate-200 px-6" aria-label="Ferramentas de escrita">{([['structure', 'Estrutura'], ['requirements', 'Requisitos'], ['goals', 'Metas'], ['session', 'Sessão']] as const).map(([id, label]) => <button key={id} type="button" className={`border-b-2 px-1 py-3 text-sm font-semibold ${tab === id ? 'border-indigo-500 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`} onClick={() => setTab(id)}>{label}</button>)}</nav><div className="min-h-0 flex-1 overflow-auto p-6">{content}</div></section></div>;
}
