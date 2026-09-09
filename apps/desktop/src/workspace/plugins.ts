import { mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

import { folioPluginManifestSchema, type FolioPluginManifest, type PluginCommandContext, type PluginCommandResult, type PluginExportResult } from '@abnt/plugin-api';
import { PluginHost } from '@abnt/plugin-host';
import type { DiagnosticDto, PublicationDocument, ResolvedDocumentDto } from '@abnt/protocol';

const PLUGINS_DIRECTORY = '.academic/plugins';
const STATE_PATH = '.academic/plugin-state.json';
type PluginState = { readonly schema: 'folio-plugin-state'; readonly version: 1; readonly enabled: Readonly<Record<string, boolean>>; };
const DEFAULT_STATE: PluginState = { schema: 'folio-plugin-state', version: 1, enabled: {} };

export interface WorkspacePluginDescriptor {
  readonly id: string;
  readonly version?: string;
  readonly apiVersion?: number;
  readonly capabilities: readonly string[];
  readonly enabled: boolean;
  readonly commands: readonly { readonly id: string; readonly title: string }[];
  readonly views: readonly { readonly id: string; readonly title: string; readonly body: string }[];
  readonly exports: readonly { readonly id: string; readonly title: string; readonly extension: string; readonly mimeType: string }[];
  readonly error?: string;
}

interface LoadedPlugin { readonly manifest: FolioPluginManifest; readonly entryPath: string; readonly descriptor: WorkspacePluginDescriptor; }

const isInside = (base: string, candidate: string): boolean => {
  const part = relative(base, candidate);
  return part === '' || (!part.startsWith('..') && !part.includes('../'));
};

/** F90/F91: descoberta local, manifestos validados e estado operacional por vault. */
export class WorkspacePluginCatalog {
  readonly #rootPath: string;
  #state: PluginState = DEFAULT_STATE;
  #plugins = new Map<string, LoadedPlugin>();
  #descriptors: readonly WorkspacePluginDescriptor[] = [];

  constructor(rootPath: string) { this.#rootPath = rootPath; }

  async discover(): Promise<readonly WorkspacePluginDescriptor[]> {
    this.#state = await this.#readState(); this.#plugins.clear();
    const directory = join(this.#rootPath, PLUGINS_DIRECTORY);
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
    const descriptors: WorkspacePluginDescriptor[] = [];
    for (const entry of entries.filter((candidate) => candidate.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      const pluginDirectory = join(directory, entry.name);
      const raw = await readFile(join(pluginDirectory, 'plugin.json'), 'utf8').catch(() => undefined);
      if (raw === undefined) { descriptors.push(this.#invalid(entry.name, 'Manifesto plugin.json não encontrado.')); continue; }
      let parsed: unknown;
      try { parsed = JSON.parse(raw); } catch { descriptors.push(this.#invalid(entry.name, 'Manifesto plugin.json inválido.')); continue; }
      const manifest = folioPluginManifestSchema.safeParse(parsed);
      if (!manifest.success) { descriptors.push(this.#invalid(entry.name, `Manifesto inválido: ${manifest.error.issues[0]?.message ?? 'dados incorretos'}`)); continue; }
      const entryPath = resolve(pluginDirectory, manifest.data.entry);
      if (!isInside(pluginDirectory, entryPath) || !(await stat(entryPath).then((value) => value.isFile()).catch(() => false))) { descriptors.push(this.#invalid(manifest.data.id, 'Entry do plugin não existe ou sai do diretório do plugin.')); continue; }
      if (this.#plugins.has(manifest.data.id)) { descriptors.push(this.#invalid(manifest.data.id, 'ID de plugin duplicado.')); continue; }
      const descriptor: WorkspacePluginDescriptor = { id: manifest.data.id, version: manifest.data.version, apiVersion: manifest.data.apiVersion, capabilities: manifest.data.capabilities, enabled: this.#state.enabled[manifest.data.id] !== false, commands: manifest.data.commands ?? [], views: manifest.data.views ?? [], exports: manifest.data.exports ?? [] };
      this.#plugins.set(manifest.data.id, { manifest: manifest.data, entryPath, descriptor }); descriptors.push(descriptor);
    }
    this.#descriptors = descriptors; return descriptors;
  }

  list(): readonly WorkspacePluginDescriptor[] { return this.#descriptors; }
  async setEnabled(id: string, enabled: boolean): Promise<readonly WorkspacePluginDescriptor[]> {
    if (!this.#plugins.has(id)) throw new Error(`Plugin desconhecido: ${id}`);
    this.#state = { ...this.#state, enabled: { ...this.#state.enabled, [id]: enabled } }; await this.#writeState(); return this.discover();
  }
  async reload(): Promise<readonly WorkspacePluginDescriptor[]> { return this.discover(); }

  async command(pluginId: string, commandId: string, context: PluginCommandContext): Promise<PluginCommandResult> {
    const plugin = this.#enabled(pluginId, 'commands'); if (!plugin.descriptor.commands.some((command) => command.id === commandId)) throw new Error(`Comando de plugin desconhecido: ${commandId}`);
    const host = new PluginHost(plugin.entryPath); try { await this.#assertIdentity(host, plugin.manifest); return await host.command(commandId, context); } finally { host.dispose(); }
  }
  async export(pluginId: string, exportId: string, publication: PublicationDocument): Promise<PluginExportResult> {
    const plugin = this.#enabled(pluginId, 'export'); if (!plugin.descriptor.exports.some((output) => output.id === exportId)) throw new Error(`Exportação de plugin desconhecida: ${exportId}`);
    const host = new PluginHost(plugin.entryPath); try { await this.#assertIdentity(host, plugin.manifest); return await host.export(exportId, publication); } finally { host.dispose(); }
  }
  async languageDiagnostics(document: ResolvedDocumentDto): Promise<readonly DiagnosticDto[]> {
    const diagnostics: DiagnosticDto[] = [];
    for (const plugin of this.#plugins.values()) {
      if (!plugin.descriptor.enabled || !plugin.manifest.capabilities.includes('language-diagnostics')) continue;
      const host = new PluginHost(plugin.entryPath);
      try { await this.#assertIdentity(host, plugin.manifest); for (const diagnostic of await host.lint(document)) diagnostics.push({ id: diagnostic.id, severity: diagnostic.severity, message: diagnostic.message, ...(diagnostic.nodeId === undefined ? {} : { nodeId: String(diagnostic.nodeId) }), ...(diagnostic.source === undefined ? {} : { source: { documentId: String(diagnostic.source.documentId), start: diagnostic.source.start, end: diagnostic.source.end } }) }); }
      catch (error) { diagnostics.push({ id: 'PLUGIN-FALHA', severity: 'warning', message: `Plugin "${plugin.manifest.id}" falhou: ${error instanceof Error ? error.message : String(error)}` }); }
      finally { host.dispose(); }
    }
    return diagnostics;
  }

  #enabled(id: string, capability: string): LoadedPlugin { const plugin = this.#plugins.get(id); if (plugin === undefined) throw new Error(`Plugin desconhecido: ${id}`); if (!plugin.descriptor.enabled) throw new Error(`Plugin desabilitado: ${id}`); if (!plugin.manifest.capabilities.includes(capability as never)) throw new Error(`Plugin não declarou capability ${capability}.`); return plugin; }
  async #assertIdentity(host: PluginHost, manifest: FolioPluginManifest): Promise<void> { const info = await host.ready(); if (info.id !== manifest.id || info.version !== manifest.version) throw new Error(`Identidade do entry diverge do manifesto de ${manifest.id}.`); }
  #invalid(id: string, error: string): WorkspacePluginDescriptor { return { id, capabilities: [], enabled: false, commands: [], views: [], exports: [], error }; }
  async #readState(): Promise<PluginState> { const raw = await readFile(join(this.#rootPath, STATE_PATH), 'utf8').catch(() => undefined); if (raw === undefined) return DEFAULT_STATE; try { const value: unknown = JSON.parse(raw); if (typeof value === 'object' && value !== null && (value as { schema?: unknown }).schema === 'folio-plugin-state' && (value as { version?: unknown }).version === 1 && typeof (value as { enabled?: unknown }).enabled === 'object' && (value as { enabled?: unknown }).enabled !== null) return value as PluginState; } catch { /* preferências corrompidas voltam ao padrão */ } return DEFAULT_STATE; }
  async #writeState(): Promise<void> { const target = join(this.#rootPath, STATE_PATH); await mkdir(join(this.#rootPath, '.academic'), { recursive: true }); const temporary = `${target}.tmp`; await writeFile(temporary, JSON.stringify(this.#state, null, 2), 'utf8'); await rename(temporary, target); }
}
