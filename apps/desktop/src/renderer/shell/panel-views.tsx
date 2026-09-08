import { useEffect, useMemo, useState, type JSX } from 'react';

import type {
  LanguageUnlinkedMentionDto,
  WorkspaceBacklinkDto,
  WorkspaceCitationExplorerResponseDto,
  WorkspaceReferenceDto,
} from '@abnt/protocol';

import type { PanelDefinition } from './panels.js';

const severityLabel: Record<'info' | 'warning' | 'error', string> = {
  info: 'Info',
  warning: 'Atenção',
  error: 'Erro',
};

const severityBorder: Record<'info' | 'warning' | 'error', string> = {
  info: 'border-slate-500',
  warning: 'border-amber-400',
  error: 'border-red-400',
};

export const diagnosticsPanel: PanelDefinition = {
  id: 'diagnostics',
  title: 'Diagnósticos',
  render({ view }): JSX.Element {
    if (view === undefined) return <p className="p-3 text-sm text-slate-500">Nenhum documento aberto.</p>;
    if (view.snapshot.diagnostics.length === 0) return <p className="p-3 text-sm text-slate-500">Sem diagnósticos.</p>;
    return (
      <ul className="list-none m-0 p-0 grid gap-1.5">
        {view.snapshot.diagnostics.map((diagnostic) => (
          <li
            key={diagnostic.id}
          className={`grid gap-0.5 rounded-r-lg border-l-[3px] bg-slate-50 py-2 pl-2.5 pr-2 text-sm leading-snug ${severityBorder[diagnostic.severity]}`}
          >
            <button type="button" className="text-left text-slate-700 hover:text-indigo-700" onClick={() => diagnostic.source !== undefined && view.controller.dispatch({ selection: { anchor: diagnostic.source.start.offset, head: diagnostic.source.start.offset } })}>
              <span className="block text-[0.7rem] uppercase tracking-wide text-slate-400">{severityLabel[diagnostic.severity]}</span>
              <span>{diagnostic.message}</span>
            </button>
          </li>
        ))}
      </ul>
    );
  },
};

/** Clique navega por offset — a mesma projeção que o language service resolve para hover/definição. */
export const outlinePanel: PanelDefinition = {
  id: 'outline',
  title: 'Sumário',
  render({ view, moveOutlineSection, renameOutlineSection }): JSX.Element {
    const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
    if (view === undefined) return <p className="p-3 text-sm text-slate-500">Nenhum documento aberto.</p>;
    if (view.snapshot.outline.length === 0) return <p className="p-3 text-sm text-slate-500">Sem estrutura reconhecida.</p>;
    const navigate = (offset: number): void => {
      view.controller.dispatch({ selection: { anchor: offset, head: offset } });
    };
    const active = [...view.snapshot.outline].reverse().find((item) => item.range.start <= view.snapshot.selection.head) ?? view.snapshot.outline[0];
    const hidden = (index: number): boolean => {
      for (let parent = index - 1; parent >= 0; parent -= 1) {
        const candidate = view.snapshot.outline[parent];
        if (candidate === undefined || candidate.depth >= view.snapshot.outline[index]!.depth) continue;
        if (collapsed.has(candidate.nodeId)) return true;
      }
      return false;
    };
    return (
      <div className="grid gap-2">
        <p className="truncate px-2 text-xs text-slate-500">Seção ativa: {active?.title}</p>
      <ul className="list-none m-0 p-0 grid gap-1">
        {view.snapshot.outline.map((item, index) => hidden(index) ? null : (
          <li key={item.nodeId} draggable onDragStart={(event) => event.dataTransfer.setData('text/x-folio-outline-offset', String(item.range.start))} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const from=Number(event.dataTransfer.getData('text/x-folio-outline-offset')); if (!Number.isFinite(from) || from === item.range.start) return; moveOutlineSection(from, from < item.range.start ? 'down' : 'up'); }}>
            <div className="flex items-center" style={{ paddingLeft: `${0.25 + Math.max(0, item.depth - 1) * 0.75}rem` }}>
              <button type="button" className="w-5 text-xs text-slate-400 hover:text-indigo-700" aria-label="Alternar subseções" onClick={() => setCollapsed((current) => { const next = new Set(current); if (next.has(item.nodeId)) next.delete(item.nodeId); else next.add(item.nodeId); return next; })}>{collapsed.has(item.nodeId) ? '▸' : '▾'}</button>
              <button type="button" className={`min-w-0 flex-1 truncate rounded-lg bg-transparent py-1 text-left text-sm hover:bg-indigo-50 ${active?.nodeId === item.nodeId ? 'font-medium text-indigo-700' : 'text-slate-700'}`} onClick={() => navigate(item.range.start)} onDoubleClick={() => { const title=window.prompt('Título da seção:',item.title); if(title!==null&&title.trim()!==''&&title.trim()!==item.title)renameOutlineSection(item.range.start,title.trim()); }}>{item.title}</button>
              <button type="button" className="px-1 text-xs text-slate-400 hover:text-indigo-700" aria-label="Mover seção acima" onClick={() => moveOutlineSection(item.range.start, 'up')}>↑</button><button type="button" className="px-1 text-xs text-slate-400 hover:text-indigo-700" aria-label="Mover seção abaixo" onClick={() => moveOutlineSection(item.range.start, 'down')}>↓</button>
            </div>
          </li>
        ))}
      </ul>
      </div>
    );
  },
};

/**
 * Backlinks vêm do índice (`workspace.backlinks`), não de parse local do
 * Markdown aberto — por isso este painel precisa buscar sob demanda em vez de
 * ler direto do snapshot da sessão, diferente de Sumário/Diagnósticos.
 *
 * "Backlinks 2.0" (F32): abaixo dos links explícitos, uma seção colapsável de
 * menções não linkadas (título de outro documento citado em prosa, sem link).
 * É sempre sugestão — "Transformar em link" é um clique explícito que despacha
 * uma transação editorial; nada muda no documento sozinho.
 */
export const backlinksPanel: PanelDefinition = {
  id: 'backlinks',
  title: 'Backlinks',
  render({ view, openDocument, linkifyMention, insertCitation }): JSX.Element {
    const fileId = view?.fileId;
    const revision = view?.snapshot.session.revision;
    const [backlinks, setBacklinks] = useState<readonly WorkspaceBacklinkDto[] | undefined>(undefined);
    const [mentions, setMentions] = useState<readonly LanguageUnlinkedMentionDto[] | undefined>(undefined);
    const [mentionsOpen, setMentionsOpen] = useState(false);

    useEffect(() => {
      if (fileId === undefined) {
        setBacklinks(undefined);
        return undefined;
      }
      let cancelled = false;
      setBacklinks(undefined);
      void window.academic.documents.backlinks({ fileId }).then((result) => {
        if (!cancelled && result.ok) setBacklinks(result.value);
      });
      return () => {
        cancelled = true;
      };
    }, [fileId]);

    useEffect(() => {
      if (fileId === undefined || revision === undefined) {
        setMentions(undefined);
        return undefined;
      }
      let cancelled = false;
      setMentions(undefined);
      void window.academic.language.unlinkedMentions({ fileId, expectedRevision: revision }).then((result) => {
        if (!cancelled && result.ok) setMentions(result.value);
      });
      return () => {
        cancelled = true;
      };
    }, [fileId, revision]);

    if (view === undefined) return <p className="text-sm text-slate-400">Nenhum documento aberto.</p>;

    return (
      <div className="grid gap-4">
        <div>
          {backlinks === undefined ? (
            <p className="text-sm text-slate-400">Carregando…</p>
          ) : backlinks.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum documento linka para este.</p>
          ) : (
            <ul className="list-none m-0 p-0 grid gap-2">
              {backlinks.map((link, index) => (
                <li key={`${link.fileId}-${link.range.start}-${index}`}>
                  <button
                    type="button"
                    className="w-full rounded-lg px-2 py-2 text-left hover:bg-indigo-50"
                    onClick={() => openDocument(link.fileId, link.path)}
                  >
                    <div className="text-xs text-slate-400 truncate">{link.path}</div>
                    <div className="text-sm truncate">{link.label || '(link sem texto)'}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-slate-200 pt-3">
          <button
            type="button"
            className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-indigo-700"
            onClick={() => setMentionsOpen((open) => !open)}
          >
            <span>Menções não linkadas{mentions !== undefined ? ` (${mentions.length})` : ''}</span>
            <span>{mentionsOpen ? '▲' : '▼'}</span>
          </button>
          {mentionsOpen &&
            (mentions === undefined ? (
              <p className="mt-2 text-sm text-slate-400">Carregando…</p>
            ) : mentions.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">Nenhuma menção não linkada.</p>
            ) : (
              <ul className="mt-2 list-none m-0 p-0 grid gap-2">
                {mentions.map((mention, index) => (
                  <li
                    key={`${mention.kind}:${mention.kind === 'document' ? mention.targetFileId : mention.referenceId}:${mention.range.start}-${index}`}
                    className="grid gap-1 border-l-[3px] border-slate-300 pl-2.5 text-sm text-slate-700"
                  >
                    <div className="truncate">"{mention.text}" → {mention.kind === 'document' ? mention.targetPath : `@${mention.referenceId}`}</div>
                    {mention.kind === 'document' ? <button
                      type="button"
                      className="w-fit rounded-lg bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                      onClick={() => linkifyMention({ range: mention.range, text: mention.text, targetPath: mention.targetPath })}
                    >Transformar em link</button> : <button
                      type="button"
                      className="w-fit rounded-lg bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                      onClick={() => insertCitation(mention.referenceId)}
                    >Inserir citação</button>}
                  </li>
                ))}
              </ul>
            ))}
        </div>
      </div>
    );
  },
};

/**
 * Bibliografia vem de `.bib` resolvido pelo host (P12) — a mesma Publication
 * AST/formatação ABNT do compilador, nunca uma segunda regra de formatação
 * aqui. Busca é local: a lista por documento tende a ser pequena o bastante
 * para não justificar um round-trip por tecla digitada.
 */
export const referencesPanel: PanelDefinition = {
  id: 'references',
  title: 'Referências',
  render({ view, openDocument, insertCitation, createLiteratureNote }): JSX.Element {
    const fileId = view?.fileId;
    const [references, setReferences] = useState<readonly WorkspaceReferenceDto[] | undefined>(undefined);
    const [filter, setFilter] = useState('');

    useEffect(() => {
      if (fileId === undefined) {
        setReferences(undefined);
        return undefined;
      }
      let cancelled = false;
      setReferences(undefined);
      void window.academic.documents.references({ fileId }).then((result) => {
        if (!cancelled && result.ok) setReferences(result.value);
      });
      return () => {
        cancelled = true;
      };
    }, [fileId]);

    const filtered = useMemo(() => {
      const query = filter.trim().toLocaleLowerCase();
      if (references === undefined) return undefined;
      if (query === '') return references;
      return references.filter(
        (reference) => reference.id.toLocaleLowerCase().includes(query) || reference.formatted.toLocaleLowerCase().includes(query),
      );
    }, [references, filter]);

    if (view === undefined) return <p className="text-sm text-slate-400">Nenhum documento aberto.</p>;
    if (references === undefined) return <p className="text-sm text-slate-400">Carregando…</p>;
    if (references.length === 0) {
      return <p className="text-sm text-slate-400">Sem bibliografia declarada (frontmatter "bibliography:").</p>;
    }
    return (
      <div className="grid gap-2 min-h-0">
        <input
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filtrar referências…"
          aria-label="Filtrar referências"
          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
        />
        <ul className="list-none m-0 p-0 grid gap-2 overflow-auto">
          {filtered?.map((reference) => (
            <li key={reference.id} className="grid gap-1 border-l-[3px] border-indigo-200 pl-2.5 text-sm text-slate-700">
              <div>{reference.formatted}</div>
              <div className="text-xs text-slate-400">Fonte: {reference.sourceLabel}</div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  className="rounded-lg bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                  onClick={() => insertCitation(reference.id)}
                >
                  Inserir citação
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                  onClick={() => createLiteratureNote(reference.id)}
                >
                  Criar nota de leitura
                </button>
                {reference.sourceFileId !== undefined && (
                  <button
                    type="button"
                    className="rounded-lg bg-transparent px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    onClick={() => openDocument(reference.sourceFileId as string, reference.sourceLabel)}
                  >
                    Abrir fonte
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  },
};

/**
 * F31: agrega `workspace.citationExplorer` (todo o vault, não só o documento
 * aberto) — contagem e locais por referência, e referências resolvidas que
 * nunca são citadas. Não depende de `view`: é vault-wide por natureza.
 */
export const citationExplorerPanel: PanelDefinition = {
  id: 'citation-explorer',
  title: 'Citações',
  render({ openDocument }): JSX.Element {
    const [data, setData] = useState<WorkspaceCitationExplorerResponseDto | undefined>(undefined);

    useEffect(() => {
      let cancelled = false;
      void window.academic.workspace.citationExplorer({}).then((result) => {
        if (!cancelled && result.ok) setData(result.value);
      });
      return () => {
        cancelled = true;
      };
    }, []);

    if (data === undefined) return <p className="text-sm text-slate-400">Carregando…</p>;

    return (
      <div className="grid gap-4">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Citadas</h3>
          {data.cited.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">Nenhuma citação encontrada no vault.</p>
          ) : (
            <ul className="mt-2 list-none m-0 p-0 grid gap-2">
              {data.cited.map((entry) => (
                <li key={entry.referenceId} className="grid gap-1 border-l-[3px] border-indigo-200 pl-2.5 text-sm text-slate-700">
                  <div>{entry.formatted ?? entry.referenceId}</div>
                  <div className="text-xs text-slate-400">
                    citado {entry.count} {entry.count === 1 ? 'vez' : 'vezes'}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {entry.locations.map((location, index) => (
                      <div key={`${location.fileId}-${location.range.start}-${index}`} className="w-full rounded-lg border border-slate-100 bg-slate-50 p-2">
                        <button
                          type="button"
                          className="text-xs font-semibold text-indigo-700 hover:text-indigo-900"
                          onClick={() => openDocument(location.fileId, location.path)}
                        >
                          {location.sectionTitle ?? location.path}
                        </button>
                        {location.snippet !== undefined && <p className="mt-1 line-clamp-3 text-xs leading-5 text-slate-600">{location.snippet}</p>}
                      </div>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-slate-200 pt-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nunca citadas</h3>
          {data.uncited.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">Todas as referências resolvidas já são citadas.</p>
          ) : (
            <ul className="mt-2 list-none m-0 p-0 grid gap-2">
              {data.uncited.map((reference) => (
                <li key={reference.id} className="border-l-[3px] border-slate-300 pl-2.5 text-sm text-slate-700">
                  {reference.formatted}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  },
};
