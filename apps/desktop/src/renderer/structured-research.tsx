import { useEffect, useRef, useState, type ChangeEvent, type JSX } from 'react';
import { buildAiContext, createLocalAiProvider, disclosureFor } from '@abnt/ai';
import type { BibliographicEntityDto, WorkspaceResearchDatasetPreviewDto, WorkspaceResearchDatasetsDto, WorkspaceSystematicReviewDto } from '@abnt/protocol';
import { createProtocol, prismaFlow, screeningAgreement } from '@abnt/systematic-review';
import { useDialogAccessibility } from './dialog-accessibility.js';

type Tab = 'review' | 'datasets' | 'ai';
type Decision = 'include' | 'exclude' | 'maybe';

const asBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(reader.error);
  reader.onload = () => resolve(String(reader.result).replace(/^data:[^;]+;base64,/u, ''));
  reader.readAsDataURL(file);
});

const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500';
const buttonClass = 'rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50';
const citationForDataset = (dataset: WorkspaceResearchDatasetsDto['datasets'][number]): Record<string, unknown> => ({ id: `dataset-${dataset.id}`, type: 'dataset', title: dataset.metadata.title, ...(dataset.metadata.creator === undefined ? {} : { author: [{ literal: dataset.metadata.creator }] }), ...(dataset.metadata.source === undefined ? {} : { URL: dataset.metadata.source }), ...(dataset.metadata.version === undefined ? {} : { version: dataset.metadata.version }), note: `SHA-256: ${dataset.sha256}` });
const manifestForDatasets = (datasets: WorkspaceResearchDatasetsDto['datasets']): Record<string, unknown> => ({ sourceRevision: 'workspace-atual', datasets: datasets.map((dataset) => ({ id: dataset.id, sha256: dataset.sha256, ...(dataset.metadata.version === undefined ? {} : { version: dataset.metadata.version }) })), analyses: [], artifacts: [] });

export function StructuredResearchDialog({ onClose, onMessage, onApplySuggestion }: {
  readonly onClose: () => void;
  readonly onMessage: (message: string) => void;
  readonly onApplySuggestion: (text: string) => Promise<void>;
}): JSX.Element {
  const dialog = useRef<HTMLElement>(null); useDialogAccessibility(dialog, onClose);
  const [tab, setTab] = useState<Tab>('review');
  const [review, setReview] = useState<WorkspaceSystematicReviewDto>({ version: 1, studies: [] });
  const [datasets, setDatasets] = useState<WorkspaceResearchDatasetsDto>({ version: 1, datasets: [] });
  const [references, setReferences] = useState<readonly BibliographicEntityDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();
  const [preview, setPreview] = useState<WorkspaceResearchDatasetPreviewDto>();
  const [title, setTitle] = useState('');
  const [question, setQuestion] = useState('');
  const [strategy, setStrategy] = useState('');
  const [criteria, setCriteria] = useState('');
  const [database, setDatabase] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [resultCount, setResultCount] = useState('0');
  const [reviewerId, setReviewerId] = useState('local');
  const [exclusionReason, setExclusionReason] = useState('');
  const [selectedStudyId, setSelectedStudyId] = useState<string>();
  const [extraction, setExtraction] = useState('');
  const [quality, setQuality] = useState<'yes' | 'no' | 'unclear' | 'na'>('unclear');
  const [evidenceTarget, setEvidenceTarget] = useState('');
  const [datasetTitle, setDatasetTitle] = useState('');
  const [datasetCreator, setDatasetCreator] = useState('');
  const [datasetSource, setDatasetSource] = useState('');
  const [previousVersionId, setPreviousVersionId] = useState('');
  const [endpoint, setEndpoint] = useState('http://127.0.0.1:11434');
  const [text, setText] = useState('');
  const [suggestion, setSuggestion] = useState<string>();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [loadedReview, loadedDatasets, library] = await Promise.all([
          window.academic.research.systematicReview(),
          window.academic.research.datasets(),
          window.academic.library.list({}),
        ]);
        if (!active) return;
        const failed = [loadedReview, loadedDatasets, library].find((result) => !result.ok);
        if (failed !== undefined && !failed.ok) {
          setLoadError(failed.error.message);
          return;
        }
        if (loadedReview.ok) {
          setReview(loadedReview.value);
          setTitle(loadedReview.value.protocol?.title ?? '');
          setQuestion(loadedReview.value.protocol?.question ?? '');
          setStrategy(loadedReview.value.protocol?.searchStrategy ?? '');
          setCriteria(loadedReview.value.protocol === undefined ? '' : [...loadedReview.value.protocol.inclusionCriteria, ...loadedReview.value.protocol.exclusionCriteria].join('\n'));
        }
        if (loadedDatasets.ok) setDatasets(loadedDatasets.value);
        if (library.ok) setReferences(library.value);
      } catch {
        if (active) setLoadError('Não foi possível carregar a pesquisa estruturada. Feche e abra a janela para tentar novamente.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const writeReview = async (next: WorkspaceSystematicReviewDto): Promise<void> => {
    const result = await window.academic.research.setSystematicReview({ review: next });
    if (result.ok) setReview(result.value); else onMessage(result.error.message);
  };
  const saveProtocol = (): void => {
    if (title.trim() === '' || question.trim() === '') { onMessage('Informe título e pergunta da revisão.'); return; }
    const allCriteria = criteria.split('\n').map((item) => item.trim()).filter(Boolean);
    void writeReview({
      ...review,
      protocol: createProtocol({ id: review.protocol?.id ?? crypto.randomUUID(), title, question, framework: 'freeform', databases: [], searchStrategy: strategy, inclusionCriteria: allCriteria, exclusionCriteria: [] }),
    });
  };
  const addStudy = (entry: BibliographicEntityDto): void => {
    if (review.studies.some((study) => study.referenceId === entry.id)) return;
    void writeReview({ ...review, studies: [...review.studies, { id: crypto.randomUUID(), referenceId: entry.id, title: entry.title ?? entry.id, stage: 'identified', decisions: [] }] });
  };
  const decide = (id: string, decision: Decision): void => void writeReview({
    ...review,
    ...(decision === 'exclude' && exclusionReason.trim() !== '' && !(review.exclusionReasons ?? []).some((reason) => reason.id === exclusionReason.trim())
      ? { exclusionReasons: [...(review.exclusionReasons ?? []), { id: exclusionReason.trim(), label: exclusionReason.trim() }] }
      : (review.exclusionReasons === undefined ? {} : { exclusionReasons: review.exclusionReasons })),
    studies: review.studies.map((study) => study.id !== id ? study : {
      ...study,
      stage: decision === 'include' ? 'included' : decision === 'exclude' ? 'excluded' : study.stage,
      decisions: [...study.decisions.filter((item) => item.reviewerId !== reviewerId.trim()), { reviewerId: reviewerId.trim() || 'local', decision, at: new Date().toISOString(), ...(decision === 'exclude' && exclusionReason.trim() !== '' ? { reasonId: exclusionReason.trim() } : {}) }],
      ...(decision === 'exclude' && exclusionReason.trim() !== '' ? { exclusionReasonId: exclusionReason.trim() } : {}),
    }),
  });
  const addSearch = (): void => {
    if (database.trim() === '' || searchQuery.trim() === '') { onMessage('Informe base e consulta da busca.'); return; }
    void writeReview({ ...review, searches: [...(review.searches ?? []), { id: crypto.randomUUID(), database: database.trim(), query: searchQuery.trim(), searchedAt: new Date().toISOString(), resultCount: Math.max(0, Number(resultCount) || 0) }] });
  };
  const saveAssessment = (): void => {
    if (selectedStudyId === undefined) { onMessage('Selecione um estudo para registrar a extração.'); return; }
    void writeReview({
      ...review,
      extractions: { ...review.extractions, [selectedStudyId]: { ...(review.extractions?.[selectedStudyId] ?? {}), summary: extraction } },
      quality: { ...review.quality, [selectedStudyId]: [{ itemId: 'quality-overall', value: quality }] },
      ...(evidenceTarget.trim() === ''
        ? (review.evidence === undefined ? {} : { evidence: review.evidence })
        : { evidence: [...(review.evidence ?? []).filter((item) => item.studyId !== selectedStudyId), { studyId: selectedStudyId, fieldId: 'summary', target: evidenceTarget.trim() }] }),
    });
  };
  const importDataset = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (file === undefined) return;
    void asBase64(file).then((base64) => window.academic.research.importDataset({
      name: file.name,
      base64,
      metadata: { title: datasetTitle.trim() || file.name, ...(datasetCreator.trim() === '' ? {} : { creator: datasetCreator.trim() }), ...(datasetSource.trim() === '' ? {} : { source: datasetSource.trim() }) },
      ...(previousVersionId === '' ? {} : { previousVersionId }),
    })).then((result) => { if (result.ok) { setDatasets(result.value); setDatasetTitle(''); setPreviousVersionId(''); } else onMessage(result.error.message); });
  };
  const showPreview = (datasetId: string): void => void window.academic.research.datasetPreview({ datasetId }).then((result) => result.ok ? setPreview(result.value) : onMessage(result.error.message));
  const copyCitation = (dataset: WorkspaceResearchDatasetsDto['datasets'][number]): void => {
    const citation = citationForDataset(dataset);
    void navigator.clipboard.writeText(JSON.stringify(citation, null, 2)).then(() => onMessage('Citação CSL-JSON copiada.'), () => onMessage('Não foi possível copiar a citação.'));
  };
  const copyManifest = (): void => {
    const manifest = manifestForDatasets(datasets.datasets);
    void navigator.clipboard.writeText(JSON.stringify(manifest, null, 2)).then(() => onMessage('Manifesto de reprodutibilidade copiado.'), () => onMessage('Não foi possível copiar o manifesto.'));
  };
  const ask = async (): Promise<void> => {
    const context = buildAiContext([{ id: 'explicit', kind: 'selection', label: 'Texto escolhido', text }]);
    const disclosure = disclosureFor({ label: 'Endpoint local', external: false }, context);
    if (disclosure.totalCharacters === 0 || !window.confirm(`Enviar ${disclosure.totalCharacters} caracteres ao endpoint local?`)) return;
    const provider = createLocalAiProvider({ model: 'local-model', transport: { async post(path, body, signal) {
      const response = await fetch(`${endpoint.replace(/\/$/u, '')}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), ...(signal === undefined ? {} : { signal }) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json() as Promise<unknown>;
    } } });
    try { setSuggestion((await provider.complete({ instruction: 'Resuma academicamente sem inventar fatos.', context })).text); }
    catch (error) { onMessage(error instanceof Error ? error.message : 'Falha no provider local.'); }
  };
  const flow = prismaFlow(review.studies as never);
  const agreement = screeningAgreement(review.studies as never);
  const selectedStudy = review.studies.find((study) => study.id === selectedStudyId);

  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-5">
    <section ref={dialog} role="dialog" aria-modal="true" aria-label="Pesquisa estruturada" className="grid h-[min(84vh,52rem)] w-full max-w-5xl grid-cols-[13rem_1fr] overflow-hidden rounded-2xl bg-white shadow-2xl">
      <aside className="border-r border-slate-200 bg-slate-50 p-4"><h2 className="font-bold text-slate-900">Pesquisa</h2><p className="mt-1 text-xs text-slate-500">Operações gravadas no vault.</p>
        {(['review', 'datasets', 'ai'] as const).map((value) => <button key={value} type="button" className={`mt-3 block w-full rounded-lg p-2 text-left text-sm ${tab === value ? 'bg-indigo-600 text-white' : 'text-slate-700 hover:bg-slate-200'}`} onClick={() => setTab(value)}>{value === 'review' ? 'Revisão sistemática' : value === 'datasets' ? 'Datasets' : 'Assistente local'}</button>)}
      </aside>
      <main className="overflow-auto p-6"><button type="button" aria-label="Fechar" className="float-right text-xl text-slate-500" onClick={onClose}>×</button>
        {loading ? <p role="status" className="grid min-h-48 place-items-center text-sm text-slate-500">Carregando pesquisa estruturada…</p> : loadError !== undefined ? <div role="alert" className="grid min-h-48 content-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800"><p>{loadError}</p><button type="button" className="justify-self-start rounded-lg border border-rose-300 px-3 py-2 font-medium" onClick={onClose}>Fechar</button></div> : <>
        {tab === 'review' && <div className="grid gap-5 pr-8"><div><h3 className="text-xl font-bold text-slate-900">Revisão sistemática</h3><p className="mt-1 text-sm text-slate-500">Protocolo, triagem e síntese ficam separados das referências canônicas.</p></div>
          <div className="grid gap-2 rounded-xl border border-slate-200 p-4"><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título da revisão" className={inputClass} /><textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Pergunta de pesquisa" className={`${inputClass} min-h-20`} /><textarea value={strategy} onChange={(event) => setStrategy(event.target.value)} placeholder="Estratégia de busca" className={`${inputClass} min-h-16`} /><textarea value={criteria} onChange={(event) => setCriteria(event.target.value)} placeholder="Critérios, um por linha" className={`${inputClass} min-h-16`} /><button type="button" className={`${buttonClass} justify-self-start`} onClick={saveProtocol}>Salvar protocolo</button></div>
          <div className="grid gap-2 rounded-xl border border-slate-200 p-4"><h4 className="font-semibold">Registro de busca</h4><div className="grid grid-cols-3 gap-2"><input value={database} onChange={(event) => setDatabase(event.target.value)} placeholder="Base" className={inputClass} /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Consulta" className={inputClass} /><input value={resultCount} onChange={(event) => setResultCount(event.target.value)} inputMode="numeric" placeholder="Resultados" className={inputClass} /></div><button type="button" className={`${buttonClass} justify-self-start`} onClick={addSearch}>Registrar busca</button>{(review.searches ?? []).map((search) => <p key={search.id} className="text-sm text-slate-600">{search.database}: {search.query} · {search.resultCount} resultados</p>)}</div>
          <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">PRISMA: {flow.identified} identificados · {flow.included} incluídos · {flow.excluded} excluídos · {agreement.conflicts.length} conflito(s) entre revisores</div>
          <div className="grid gap-2"><h4 className="font-semibold">Adicionar estudos da biblioteca</h4>{references.filter((entry) => !review.studies.some((study) => study.referenceId === entry.id)).slice(0, 12).map((entry) => <button key={entry.id} type="button" className="rounded-lg border border-slate-200 p-2 text-left text-sm hover:border-indigo-300" onClick={() => addStudy(entry)}>{entry.title ?? entry.id}</button>)}</div>
          <div className="grid gap-2"><h4 className="font-semibold">Triagem</h4><div className="grid grid-cols-2 gap-2"><input value={reviewerId} onChange={(event) => setReviewerId(event.target.value)} placeholder="Identificador do revisor" className={inputClass} /><input value={exclusionReason} onChange={(event) => setExclusionReason(event.target.value)} placeholder="Motivo de exclusão" className={inputClass} /></div>{review.studies.map((study) => <div key={study.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm"><button type="button" className="flex-1 text-left font-medium" onClick={() => { setSelectedStudyId(study.id); setExtraction(review.extractions?.[study.id]?.summary ?? ''); setQuality(review.quality?.[study.id]?.[0]?.value ?? 'unclear'); setEvidenceTarget(review.evidence?.find((item) => item.studyId === study.id)?.target ?? ''); }}>{study.title} <span className="font-normal text-slate-500">· {study.stage}</span>{study.decisions.length > 1 && <span className="ml-2 text-xs text-amber-700">{new Set(study.decisions.map((item) => item.decision)).size > 1 ? 'conflito' : 'acordo'}</span>}</button><button type="button" onClick={() => decide(study.id, 'include')}>Incluir</button><button type="button" onClick={() => decide(study.id, 'exclude')}>Excluir</button><button type="button" onClick={() => decide(study.id, 'maybe')}>Rever</button></div>)}</div>
          {selectedStudy !== undefined && <div className="grid gap-2 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4"><h4 className="font-semibold">Extração e qualidade: {selectedStudy.title}</h4><textarea value={extraction} onChange={(event) => setExtraction(event.target.value)} placeholder="Síntese extraída do estudo" className={`${inputClass} min-h-24`} /><label className="text-sm">Qualidade geral<select value={quality} onChange={(event) => setQuality(event.target.value as typeof quality)} className={`${inputClass} mt-1`}><option value="yes">Favorável</option><option value="no">Não favorável</option><option value="unclear">Incerta</option><option value="na">Não aplicável</option></select></label><input value={evidenceTarget} onChange={(event) => setEvidenceTarget(event.target.value)} placeholder="Destino da evidência, por exemplo: Discussão" className={inputClass} /><button type="button" className={`${buttonClass} justify-self-start`} onClick={saveAssessment}>Salvar extração</button></div>}
        </div>}
        {tab === 'datasets' && <div className="grid gap-5 pr-8"><div><h3 className="text-xl font-bold text-slate-900">Datasets de pesquisa</h3><p className="mt-1 text-sm text-slate-500">Os bytes são guardados no vault; registro, hash e prévia são derivados no host.</p></div><div className="grid gap-2 rounded-xl border border-slate-200 p-4"><input value={datasetTitle} onChange={(event) => setDatasetTitle(event.target.value)} placeholder="Título do dataset (opcional)" className={inputClass} /><input value={datasetCreator} onChange={(event) => setDatasetCreator(event.target.value)} placeholder="Autor ou organização" className={inputClass} /><input value={datasetSource} onChange={(event) => setDatasetSource(event.target.value)} placeholder="URL de origem" className={inputClass} /><select value={previousVersionId} onChange={(event) => setPreviousVersionId(event.target.value)} className={inputClass}><option value="">Nova série de dados</option>{datasets.datasets.map((dataset) => <option key={dataset.id} value={dataset.id}>Nova versão de: {dataset.metadata.title}</option>)}</select><input ref={input} type="file" onChange={importDataset} /><p className="text-xs text-slate-500">CSV, TSV e JSON têm prévia tabular; os demais formatos permanecem binários e rastreáveis.</p></div><button type="button" className={`${buttonClass} justify-self-start`} disabled={datasets.datasets.length === 0} onClick={copyManifest}>Copiar manifesto de reprodutibilidade</button>{datasets.datasets.map((dataset) => <div key={dataset.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-center gap-2"><b>{dataset.metadata.title}</b><span className="text-sm text-slate-500">{dataset.format} · SHA-256 {dataset.sha256.slice(0, 12)}</span></div><p className="mt-1 text-sm text-slate-600">{dataset.metadata.creator ?? 'Autor não informado'}{dataset.metadata.source === undefined ? '' : ` · ${dataset.metadata.source}`}{dataset.previousVersionId === undefined ? '' : ' · versão vinculada'}</p><div className="mt-3 flex gap-2"><button type="button" className="rounded border px-2 py-1 text-sm" onClick={() => showPreview(dataset.id)}>Prévia e dicionário</button><button type="button" className="rounded border px-2 py-1 text-sm" onClick={() => copyCitation(dataset)}>Copiar citação</button></div></div>)}{preview !== undefined && <div className="grid gap-3 rounded-xl bg-slate-50 p-4"><h4 className="font-semibold">Prévia e dicionário inferido</h4>{preview.preview === undefined ? <p className="text-sm text-slate-600">Este formato não possui prévia tabular.</p> : <><div className="overflow-auto"><table className="min-w-full text-left text-xs"><thead><tr>{preview.preview.columns.map((column) => <th key={column} className="border-b p-2">{column}</th>)}</tr></thead><tbody>{preview.preview.rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} className="border-b p-2">{cell}</td>)}</tr>)}</tbody></table></div><p className="text-xs text-slate-500">{preview.preview.totalRows ?? preview.preview.rows.length} linhas</p></>}<ul className="grid gap-1 text-sm">{preview.schema.map((column) => <li key={column.name}>{column.name}: {column.type}, {column.distinct} distintos, {column.missing} ausentes</li>)}</ul></div>}</div>}
        {tab === 'ai' && <div className="grid gap-4 pr-8"><div><h3 className="text-xl font-bold text-slate-900">Assistente local</h3><p className="mt-1 text-sm text-slate-500">Nada é enviado sem disclosure e confirmação. O endpoint é usado apenas nesta solicitação.</p></div><input value={endpoint} onChange={(event) => setEndpoint(event.target.value)} aria-label="Endpoint local" className={inputClass} /><textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Texto escolhido para resumir" className={`${inputClass} min-h-44`} /><button type="button" className={`${buttonClass} justify-self-start`} onClick={() => void ask()}>Ver disclosure e resumir</button>{suggestion !== undefined && <div className="grid gap-3 rounded-xl bg-slate-50 p-4"><pre className="whitespace-pre-wrap font-sans text-sm">{suggestion}</pre><button type="button" className="justify-self-start rounded-lg border border-indigo-300 px-3 py-2 text-sm text-indigo-700" onClick={() => void onApplySuggestion(suggestion)}>Inserir no documento ativo</button></div>}</div>}
        </>}
      </main>
    </section>
  </div>;
}
