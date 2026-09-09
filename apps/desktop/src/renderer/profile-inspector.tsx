import { useEffect, useRef, useState, type JSX } from 'react';

import type { WorkspaceProfileManifestDto, WorkspaceProfileValidationPreviewDto } from '@abnt/protocol';

interface ProfileInspectorDialogProps {
  readonly fileId: string;
  readonly expectedRevision: number;
  readonly activeProfileId: string;
  readonly onApply: (profileId: string) => void;
  readonly onClose: () => void;
}

interface ProfileDifference {
  readonly label: string;
  readonly current: string;
  readonly other: string;
}

const list = (values: readonly string[]): string => values.length === 0 ? '—' : values.join(', ');
const pagePolicy = (profile: WorkspaceProfileManifestDto): string =>
  `${profile.pagePolicy.size} · ${profile.pagePolicy.margin.top}/${profile.pagePolicy.margin.right}/${profile.pagePolicy.margin.bottom}/${profile.pagePolicy.margin.left}`;

/** F100: apresentação editorial dos manifests, sem importar profiles executáveis. */
export const compareProfileManifests = (current: WorkspaceProfileManifestDto, other: WorkspaceProfileManifestDto): readonly ProfileDifference[] => {
  const candidates: readonly ProfileDifference[] = [
    { label: 'Sistema de citação', current: current.citationSystem ?? 'não declarado', other: other.citationSystem ?? 'não declarado' },
    { label: 'Metadados exigidos', current: list(current.requiredMetadata), other: list(other.requiredMetadata) },
    { label: 'Capacidades', current: list(current.capabilities), other: list(other.capabilities) },
    { label: 'Política de página', current: pagePolicy(current), other: pagePolicy(other) },
  ];
  return candidates.filter((difference) => difference.current !== difference.other);
};

const impact = (value: number, singular: string, plural: string): string => {
  if (value === 0) return `sem alteração em ${plural}`;
  const label = Math.abs(value) === 1 ? singular : plural;
  return value > 0 ? `+${value} ${label}` : `${value} ${label}`;
};

export function ProfileInspectorDialog({ fileId, expectedRevision, activeProfileId, onApply, onClose }: ProfileInspectorDialogProps): JSX.Element {
  const [profiles, setProfiles] = useState<readonly WorkspaceProfileManifestDto[]>([]);
  const [selectedId, setSelectedId] = useState(activeProfileId);
  const [comparisonId, setComparisonId] = useState('');
  const [preview, setPreview] = useState<WorkspaceProfileValidationPreviewDto | undefined>();
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const epoch = useRef(0);

  useEffect(() => {
    let active = true;
    void window.academic.workspace.profiles().then((result) => {
      if (!active) return;
      if (!result.ok) { setError(result.error.message); setLoading(false); return; }
      setProfiles(result.value);
      if (!result.value.some((profile) => profile.id === selectedId)) setSelectedId(result.value[0]?.id ?? '');
      setLoading(false);
    });
    return () => { active = false; };
  }, [selectedId]);

  const selected = profiles.find((profile) => profile.id === selectedId);
  const compared = profiles.find((profile) => profile.id === comparisonId);
  const differences = selected === undefined || compared === undefined ? [] : compareProfileManifests(selected, compared);
  const previewProfile = async (): Promise<void> => {
    if (selected === undefined) return;
    const token = ++epoch.current;
    setPreviewing(true); setError(undefined);
    const result = await window.academic.workspace.previewProfileValidation({ fileId, expectedRevision, profileId: selected.id });
    if (token !== epoch.current) return;
    setPreviewing(false);
    if (!result.ok) { setError(result.error.message); return; }
    if (result.value.revision !== expectedRevision) { setError('O documento mudou durante a avaliação; execute novamente.'); return; }
    setPreview(result.value);
  };

  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-5"><section role="dialog" aria-modal="true" aria-labelledby="profile-title" className="grid h-[min(82vh,52rem)] w-full max-w-5xl grid-rows-[auto_minmax(0,1fr)_auto] rounded-lg border border-slate-200 bg-white p-5 text-slate-800 shadow-2xl"><div className="flex"><div><h2 id="profile-title" className="text-lg font-semibold">Profiles de publicação</h2><p className="text-sm text-slate-500">Regras e capacidades declaradas pelo compilador; aplicar altera somente o frontmatter.</p></div><button type="button" aria-label="Fechar profiles" className="ml-auto text-xl text-slate-500" onClick={onClose}>×</button></div>{loading ? <p className="py-10 text-center text-slate-500">Carregando profiles…</p> : <div className="mt-4 grid min-h-0 gap-4 md:grid-cols-[15rem_minmax(0,1fr)]"><nav aria-label="Profiles disponíveis" className="overflow-auto rounded-lg border border-slate-200 p-2">{profiles.map((profile) => <button key={profile.id} type="button" onClick={() => { setSelectedId(profile.id); setPreview(undefined); }} className={`mb-1 w-full rounded-md p-2 text-left ${profile.id === selectedId ? 'bg-indigo-100 text-indigo-950' : 'hover:bg-slate-100'}`}><strong className="block text-sm">{profile.name}</strong><span className="font-mono text-xs text-slate-500">{profile.id}</span></button>)}</nav><div className="min-h-0 overflow-auto pr-1">{selected === undefined ? <p className="text-slate-500">Nenhum profile disponível.</p> : <><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><h3 className="text-base font-semibold">{selected.name}</h3><span className="font-mono text-xs text-slate-500">v{selected.version}</span>{selected.composition !== undefined && <span className="rounded bg-violet-100 px-2 py-0.5 text-xs text-violet-800">compõe {selected.composition.baseProfileId}</span>}</div>{selected.description !== undefined && <p className="mt-1 text-sm text-slate-600">{selected.description}</p>}<dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="font-medium">Tipos de documento</dt><dd className="text-slate-600">{list(selected.documentKinds)}</dd></div><div><dt className="font-medium">Sistema de citação</dt><dd className="text-slate-600">{selected.citationSystem ?? 'Não declarado'}</dd></div><div><dt className="font-medium">Metadados exigidos</dt><dd className="text-slate-600">{list(selected.requiredMetadata)}</dd></div><div><dt className="font-medium">Capacidades</dt><dd className="text-slate-600">{list(selected.capabilities)}</dd></div><div><dt className="font-medium">Página</dt><dd className="text-slate-600">{pagePolicy(selected)}</dd></div>{selected.composition !== undefined && <div><dt className="font-medium">Overrides explícitos</dt><dd className="text-slate-600">{list(selected.composition.overrides)}</dd></div>}</dl><section className="mt-5"><h4 className="font-medium">Regras ativas</h4><ul className="mt-2 divide-y rounded border border-slate-200 text-sm">{selected.rules.map((rule) => <li key={rule.id} className="p-2"><span className="font-mono text-xs text-indigo-700">{rule.id}</span>{rule.standard !== undefined && <span className="ml-2 text-xs text-slate-500">{rule.standard}</span>}<p className="text-slate-600">{rule.description}</p></li>)}</ul></section><section className="mt-5 rounded-lg bg-slate-50 p-3"><div className="flex flex-wrap items-center gap-2"><h4 className="font-medium">Comparar com</h4><select value={comparisonId} onChange={(event) => setComparisonId(event.target.value)} className="rounded border border-slate-300 bg-white p-1 text-sm"><option value="">Escolha outro profile</option>{profiles.filter((profile) => profile.id !== selected.id).map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></div>{compared !== undefined && <ul className="mt-2 text-sm text-slate-600">{differences.length === 0 ? <li>Sem diferenças declaradas.</li> : differences.map((difference) => <li key={difference.label}><strong>{difference.label}:</strong> {difference.current} → {difference.other}</li>)}</ul>}</section><section className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3"><div className="flex flex-wrap items-center gap-2"><h4 className="font-medium text-amber-950">Impacto de validação</h4><button type="button" disabled={previewing} onClick={() => void previewProfile()} className="rounded bg-amber-700 px-2.5 py-1 text-sm text-white disabled:opacity-60">{previewing ? 'Avaliando…' : 'Avaliar sem aplicar'}</button></div>{preview !== undefined && <p className="mt-2 text-sm text-amber-950"><strong>{preview.errors}</strong> erros, <strong>{preview.warnings}</strong> avisos · {impact(preview.errorDelta, 'erro', 'erros')} · {impact(preview.warningDelta, 'aviso', 'avisos')}</p>}</section></>}</div></div>}{error !== undefined && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}<div className="mt-4 flex justify-end gap-2"><button type="button" className="rounded-lg bg-slate-100 px-3 py-1.5 text-slate-700 hover:bg-slate-200" onClick={onClose}>Cancelar</button><button type="button" disabled={selected === undefined} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-white disabled:opacity-60" onClick={() => selected !== undefined && onApply(selected.id)}>Aplicar profile</button></div></section></div>;
}
