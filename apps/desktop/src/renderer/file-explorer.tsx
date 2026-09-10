import { useEffect, useLayoutEffect, useMemo, useRef, useState, type JSX } from 'react';

import type { WorkspaceFileDto } from '@abnt/protocol';

import { FolioIcon, type FolioIconName } from './icons.js';

interface FileTreeDirectory {
  readonly name: string;
  readonly path: string;
  readonly directories: readonly FileTreeDirectory[];
  readonly files: readonly WorkspaceFileDto[];
}

interface MutableDirectory {
  readonly name: string;
  readonly path: string;
  readonly directories: Map<string, MutableDirectory>;
  readonly files: WorkspaceFileDto[];
}

export function buildWorkspaceFileTree(files: readonly WorkspaceFileDto[]): FileTreeDirectory {
  const root: MutableDirectory = { name: '', path: '', directories: new Map(), files: [] };
  for (const file of files) {
    const parts = file.path.split('/');
    const name = parts.pop();
    if (name === undefined) continue;
    let directory = root;
    for (const part of parts) {
      const path = directory.path === '' ? part : `${directory.path}/${part}`;
      let child = directory.directories.get(part);
      if (child === undefined) {
        child = { name: part, path, directories: new Map(), files: [] };
        directory.directories.set(part, child);
      }
      directory = child;
    }
    // `.gitkeep` materializa uma pasta vazia no filesystem local, mas não é
    // um documento que o pesquisador precise ver no explorador.
    if (name !== '.gitkeep') directory.files.push(file);
  }
  const freeze = (directory: MutableDirectory): FileTreeDirectory => ({
    name: directory.name,
    path: directory.path,
    directories: [...directory.directories.values()].sort((left, right) => left.name.localeCompare(right.name)).map(freeze),
    files: [...directory.files].sort((left, right) => left.path.localeCompare(right.path)),
  });
  return freeze(root);
}

const fileName = (path: string): string => path.split('/').at(-1) ?? path;
const fileIconName = (path: string): FolioIconName => path.toLowerCase().endsWith('.pdf') ? 'pdf' : 'file';
const draggedFileMimeType = 'application/x-folio-file-id';

const filterFileTree = (directory: FileTreeDirectory, query: string): FileTreeDirectory => {
  const needle = query.trim().toLocaleLowerCase('pt-BR');
  if (needle === '') return directory;
  const directories = directory.directories
    .map((child) => filterFileTree(child, query))
    .filter((child) => child.name.toLocaleLowerCase('pt-BR').includes(needle) || child.directories.length > 0 || child.files.length > 0);
  const files = directory.files.filter((file) => file.path.toLocaleLowerCase('pt-BR').includes(needle));
  return { ...directory, directories, files };
};

function FileContextMenuItem({ icon, children, disabled = false, onClick }: {
  readonly icon: FolioIconName;
  readonly children: string;
  readonly disabled?: boolean;
  readonly onClick: () => void;
}): JSX.Element {
  return <button type="button" role="menuitem" disabled={disabled} className="folio-file-menu-item" onClick={onClick}><span className="folio-file-menu-icon"><FolioIcon name={icon} className="h-4 w-4" /></span><span className="min-w-0 flex-1 truncate">{children}</span></button>;
}

export function WorkspaceFileExplorer({
  files,
  activeFileId,
  hasActiveEditor = false,
  onOpenFile,
  onOpenFileInSplit,
  onRenameFile,
  onMoveFile,
  onMoveFilePrompt,
  onDuplicateFile,
  onCreate,
  onCreateFolder,
  expanded = false,
  onToggleExpanded,
}: {
  readonly files: readonly WorkspaceFileDto[];
  readonly activeFileId?: string;
  readonly hasActiveEditor?: boolean;
  readonly onOpenFile: (file: WorkspaceFileDto) => void;
  readonly onOpenFileInSplit?: (file: WorkspaceFileDto) => void;
  readonly onRenameFile?: (file: WorkspaceFileDto) => void;
  readonly onMoveFile?: (file: WorkspaceFileDto, targetDirectory: string) => void;
  readonly onMoveFilePrompt?: (file: WorkspaceFileDto) => void;
  readonly onDuplicateFile?: (file: WorkspaceFileDto) => void;
  readonly onCreate: () => void;
  readonly onCreateFolder: () => void;
  readonly expanded?: boolean;
  readonly onToggleExpanded?: () => void;
}): JSX.Element {
  const tree = useMemo(() => buildWorkspaceFileTree(files), [files]);
  const [filterQuery, setFilterQuery] = useState('');
  const visibleTree = useMemo(() => filterFileTree(tree, filterQuery), [filterQuery, tree]);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ readonly file: WorkspaceFileDto; readonly x: number; readonly y: number } | undefined>(undefined);
  const [contextMenuHeight, setContextMenuHeight] = useState<number | undefined>(undefined);
  const [dragOverPath, setDragOverPath] = useState<string | undefined>(undefined);
  const contextMenuHost = useRef<HTMLDivElement>(null);
  const toggle = (path: string): void => setCollapsed((current) => {
    const next = new Set(current); if (next.has(path)) next.delete(path); else next.add(path); return next;
  });
  const closeContextMenu = (): void => setContextMenu(undefined);
  const canDrag = onMoveFile !== undefined;

  useEffect(() => {
    if (contextMenu === undefined) return undefined;
    const closeWhenClickingElsewhere = (event: PointerEvent): void => {
      const target = event.target;
      if (target instanceof Node && contextMenuHost.current?.contains(target)) return;
      closeContextMenu();
    };
    const closeOnEscape = (event: KeyboardEvent): void => { if (event.key === 'Escape') closeContextMenu(); };
    document.addEventListener('pointerdown', closeWhenClickingElsewhere, true);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeWhenClickingElsewhere, true);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [contextMenu]);

  useLayoutEffect(() => {
    if (contextMenu === undefined) { setContextMenuHeight(undefined); return; }
    setContextMenuHeight(contextMenuHost.current?.getBoundingClientRect().height);
  }, [contextMenu]);

  const acceptDrag = (event: React.DragEvent): boolean => canDrag && event.dataTransfer.types.includes(draggedFileMimeType);
  const dropOnDirectory = (event: React.DragEvent, targetDirectory: string): void => {
    event.preventDefault();
    event.stopPropagation();
    setDragOverPath(undefined);
    const fileId = event.dataTransfer.getData(draggedFileMimeType);
    const dragged = files.find((file) => file.fileId === fileId);
    if (dragged !== undefined) onMoveFile?.(dragged, targetDirectory);
  };

  const renderDirectory = (directory: FileTreeDirectory, depth: number): JSX.Element[] => {
    const hidden = directory.path !== '' && collapsed.has(directory.path);
    const rows: JSX.Element[] = [];
    for (const child of directory.directories) {
      const childHidden = collapsed.has(child.path);
      rows.push(<li key={`directory:${child.path}`}><button
        type="button"
        className={`flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-slate-600 transition-colors hover:bg-white hover:text-indigo-700 ${dragOverPath === child.path ? 'bg-indigo-100 ring-2 ring-inset ring-indigo-400' : ''}`}
        style={{ paddingLeft: `${0.5 + depth * 0.85}rem` }}
        onClick={() => toggle(child.path)}
        onDragOver={(event) => { if (acceptDrag(event)) { event.preventDefault(); event.stopPropagation(); setDragOverPath(child.path); } }}
        onDragLeave={() => setDragOverPath((current) => current === child.path ? undefined : current)}
        onDrop={(event) => dropOnDirectory(event, child.path)}
      ><span className="grid w-3 shrink-0 place-items-center text-slate-400"><FolioIcon name={childHidden ? 'chevronRight' : 'chevronDown'} className="h-3 w-3" /></span><FolioIcon name="folder" className="h-3.5 w-3.5 shrink-0 text-indigo-400" /><span className="truncate">{child.name}</span></button></li>);
      if (!childHidden) rows.push(...renderDirectory(child, depth + 1));
    }
    if (!hidden) for (const file of directory.files) rows.push(<li key={file.fileId}><button
      type="button"
      title={file.path}
      draggable={canDrag}
      className={`flex w-full items-center gap-2 rounded-lg py-2 pr-2 text-left text-sm transition-colors ${file.fileId === activeFileId ? 'bg-white font-semibold text-indigo-700 shadow-sm ring-1 ring-indigo-100' : 'text-slate-600 hover:bg-white hover:text-slate-900'}`}
      style={{ paddingLeft: `${1.6 + depth * 0.85}rem` }}
      onClick={() => onOpenFile(file)}
      onContextMenu={(event) => { event.preventDefault(); setContextMenu({ file, x: event.clientX, y: event.clientY }); }}
      onDragStart={(event) => { event.dataTransfer.setData(draggedFileMimeType, file.fileId); event.dataTransfer.effectAllowed = 'move'; }}
    ><FolioIcon name={fileIconName(file.path)} className="h-3.5 w-3.5 shrink-0 text-slate-400" /><span className="min-w-0 flex-1 truncate">{fileName(file.path)}</span></button></li>);
    return rows;
  };
  const isEmpty = tree.directories.length === 0 && tree.files.length === 0;
  const noMatches = !isEmpty && visibleTree.directories.length === 0 && visibleTree.files.length === 0;
  const menuWidth = 224;
  const menuHeight = contextMenuHeight ?? 320;
  const menuStyle = contextMenu === undefined ? undefined : {
    left: Math.max(8, Math.min(contextMenu.x, window.innerWidth - menuWidth - 8)),
    top: Math.max(8, Math.min(contextMenu.y, window.innerHeight - menuHeight - 8)),
  };
  return <nav aria-label="Explorador de arquivos" className={`grid min-h-0 flex-1 grid-rows-[auto_auto_minmax(0,1fr)] ${expanded ? 'folio-file-explorer-expanded' : ''}`}>
    <header className="flex items-center gap-2 border-b border-slate-200 pb-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><FolioIcon name="folder" className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1"><h2 className="text-sm font-bold text-slate-800">Explorador</h2><p className="text-[11px] text-slate-400">{files.length} {files.length === 1 ? 'arquivo' : 'arquivos'} no vault</p></div>
      <button type="button" title="Criar pasta" aria-label="Criar pasta" className="folio-control relative grid h-8 w-8 place-items-center rounded-lg text-slate-500" onClick={onCreateFolder}><FolioIcon name="folder" className="h-3.5 w-3.5" /><FolioIcon name="add" className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-white" /></button>
      <button type="button" title="Criar documento" aria-label="Criar documento" className="folio-primary grid h-8 w-8 place-items-center rounded-lg" onClick={onCreate}><FolioIcon name="add" className="h-3.5 w-3.5" /></button>
      {onToggleExpanded !== undefined && <button type="button" title="Fechar explorador" aria-label="Fechar explorador" className="folio-control grid h-8 w-8 place-items-center rounded-lg text-lg leading-none text-slate-500" onClick={onToggleExpanded}>×</button>}
    </header>
    <div className="py-3"><label className="sr-only" htmlFor="explorer-filter">Filtrar arquivos</label><div className="relative"><FolioIcon name="search" className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" /><input id="explorer-filter" type="search" value={filterQuery} onChange={(event) => setFilterQuery(event.target.value)} placeholder="Filtrar arquivos…" className="folio-input w-full rounded-xl py-2 pl-9 pr-3 text-xs" /></div></div>
    <ul
    className={`m-0 min-h-0 list-none overflow-auto rounded-xl border border-slate-100 bg-slate-50/60 p-1.5 ${dragOverPath === '' ? 'bg-indigo-50 ring-2 ring-inset ring-indigo-300' : ''}`}
    onDragOver={(event) => { if (acceptDrag(event)) { event.preventDefault(); setDragOverPath(''); } }}
    onDragLeave={(event) => { if (event.currentTarget === event.target) setDragOverPath((current) => current === '' ? undefined : current); }}
    onDrop={(event) => dropOnDirectory(event, '')}
  >{isEmpty ? <li className="px-3 py-6 text-center text-sm leading-6 text-slate-500">Nenhum arquivo ainda.<br /><button type="button" className="mt-2 font-semibold text-indigo-700 hover:text-indigo-800" onClick={onCreate}>Criar documento</button></li> : noMatches ? <li className="px-3 py-6 text-center text-sm leading-6 text-slate-500">Nenhum arquivo encontrado para<br /><strong className="font-semibold text-slate-700">“{filterQuery}”</strong></li> : renderDirectory(visibleTree, 0)}</ul>
    {contextMenu !== undefined && <div ref={contextMenuHost} className="folio-actions-menu folio-file-menu fixed z-50" style={{ width: `${menuWidth}px`, ...menuStyle }} role="menu" aria-label={`Ações de ${contextMenu.file.path}`}>
      <div className="folio-file-menu-title"><span className="truncate">{contextMenu.file.path}</span></div>
      <FileContextMenuItem icon="file" onClick={() => { onOpenFile(contextMenu.file); closeContextMenu(); }}>Abrir</FileContextMenuItem>
      {onOpenFileInSplit !== undefined && <FileContextMenuItem icon="split" disabled={!hasActiveEditor} onClick={() => { onOpenFileInSplit(contextMenu.file); closeContextMenu(); }}>Abrir ao lado</FileContextMenuItem>}
      <div className="folio-file-menu-separator" />
      <FileContextMenuItem icon="copy" onClick={() => { void navigator.clipboard.writeText(contextMenu.file.path); closeContextMenu(); }}>Copiar caminho</FileContextMenuItem>
      {onDuplicateFile !== undefined && <FileContextMenuItem icon="duplicate" onClick={() => { onDuplicateFile(contextMenu.file); closeContextMenu(); }}>Duplicar</FileContextMenuItem>}
      {onRenameFile !== undefined && <FileContextMenuItem icon="edit" onClick={() => { onRenameFile(contextMenu.file); closeContextMenu(); }}>Renomear…</FileContextMenuItem>}
      {onMoveFilePrompt !== undefined && <FileContextMenuItem icon="folder" onClick={() => { onMoveFilePrompt(contextMenu.file); closeContextMenu(); }}>Mover para pasta…</FileContextMenuItem>}
    </div>}
  </nav>;
}
