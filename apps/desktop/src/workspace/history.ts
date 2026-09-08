import { execFile } from 'node:child_process';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';

const exec = promisify(execFile);

export interface HistoryRevision { readonly id: string; readonly source: 'git' | 'snapshot'; readonly label: string; readonly createdAt: number; }
interface Snapshot extends HistoryRevision { readonly source: 'snapshot'; readonly fileId: string; readonly content: string; }
interface SnapshotStore { readonly version: 1; readonly snapshots: readonly Snapshot[]; }
export interface HistoryLine { readonly kind: 'equal' | 'added' | 'removed'; readonly leftLine?: number; readonly rightLine?: number; readonly text: string; }

const empty: SnapshotStore = { version: 1, snapshots: [] };
const gitHash = /^[0-9a-f]{7,64}$/iu;

/** Histórico operacional: Git é somente leitura; snapshots ficam em `.academic`. */
export class WorkspaceHistory {
  readonly #path: string;
  constructor(readonly rootPath: string) { this.#path = join(rootPath, '.academic', 'history', 'snapshots.json'); }

  async revisions(fileId: string, path: string): Promise<{ readonly gitAvailable: boolean; readonly revisions: readonly HistoryRevision[] }> {
    const snapshots = (await this.#read()).snapshots.filter((item) => item.fileId === fileId).map(({ content: _content, fileId: _fileId, ...item }) => item);
    const git = await this.#gitLog(path);
    return { gitAvailable: git !== undefined, revisions: [...(git ?? []), ...snapshots].sort((a, b) => b.createdAt - a.createdAt) };
  }

  async content(fileId: string, path: string, revisionId: string, current: string): Promise<string | undefined> {
    if (revisionId === 'current') return current;
    if (revisionId.startsWith('snapshot:')) return (await this.#read()).snapshots.find((item) => item.id === revisionId && item.fileId === fileId)?.content;
    if (!revisionId.startsWith('git:') || !gitHash.test(revisionId.slice(4))) return undefined;
    try { return (await exec('git', ['-C', this.rootPath, 'show', `${revisionId.slice(4)}:${path}`], { timeout: 4_000, maxBuffer: 4 * 1024 * 1024 })).stdout; } catch { return undefined; }
  }

  async createSnapshot(fileId: string, label: string | undefined, content: string): Promise<HistoryRevision> {
    const snapshot: Snapshot = { id: `snapshot:${randomUUID()}`, source: 'snapshot', fileId, label: label?.trim() || 'Snapshot manual', createdAt: Date.now(), content };
    const store = await this.#read(); await this.#write({ version: 1, snapshots: [...store.snapshots, snapshot] });
    const { content: _content, fileId: _fileId, ...revision } = snapshot; return revision;
  }

  async #gitLog(path: string): Promise<readonly HistoryRevision[] | undefined> {
    try {
      const inside = (await exec('git', ['-C', this.rootPath, 'rev-parse', '--is-inside-work-tree'], { timeout: 2_000 })).stdout.trim();
      if (inside !== 'true') return undefined;
      const stdout = (await exec('git', ['-C', this.rootPath, 'log', '--format=%H%x00%ct%x00%s', '--', path], { timeout: 4_000, maxBuffer: 2 * 1024 * 1024 })).stdout;
      return stdout.split('\n').filter(Boolean).flatMap((line) => { const [hash, timestamp, label] = line.split('\0'); return hash === undefined || timestamp === undefined ? [] : [{ id: `git:${hash}`, source: 'git' as const, label: label || hash.slice(0, 9), createdAt: Number(timestamp) * 1000 }]; });
    } catch { return undefined; }
  }
  async #read(): Promise<SnapshotStore> { try { const value = JSON.parse(await readFile(this.#path, 'utf8')) as SnapshotStore; return value.version === 1 && Array.isArray(value.snapshots) ? value : empty; } catch { return empty; } }
  async #write(value: SnapshotStore): Promise<void> { await mkdir(join(this.rootPath, '.academic', 'history'), { recursive: true }); const temporary = `${this.#path}.${randomUUID()}.tmp`; await writeFile(temporary, JSON.stringify(value, null, 2), 'utf8'); await rename(temporary, this.#path); }
}

/** LCS simples: presentation DTO, nunca parse estrutural no renderer. */
export const lineDiff = (left: string, right: string): readonly HistoryLine[] => {
  const a = left.split('\n'); const b = right.split('\n'); const table = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) for (let j = b.length - 1; j >= 0; j -= 1) table[i]![j] = a[i] === b[j] ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
  const result: HistoryLine[] = []; let i = 0; let j = 0;
  while (i < a.length || j < b.length) { if (i < a.length && j < b.length && a[i] === b[j]) { result.push({ kind: 'equal', leftLine: i + 1, rightLine: j + 1, text: a[i]! }); i += 1; j += 1; } else if (j < b.length && (i === a.length || table[i]![j + 1]! >= table[i + 1]![j]!)) { result.push({ kind: 'added', rightLine: j + 1, text: b[j]! }); j += 1; } else { result.push({ kind: 'removed', leftLine: i + 1, text: a[i]! }); i += 1; } }
  return result;
};
