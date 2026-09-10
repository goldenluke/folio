import type { FolioPluginCapability, FolioPluginManifest, FolioPluginSetting } from './model.js';

export const pluginDataPath = (pluginId: string): string => `.academic/plugins-data/${pluginId}`;
export const requestedPermissions = (manifest: FolioPluginManifest): readonly FolioPluginCapability[] => [...new Set(manifest.capabilities.filter((capability) => ['read-document', 'read-library', 'network', 'write-operational-state', 'export'].includes(capability)))];
const parts = (value: string): readonly number[] => value.split('.').map((part) => Number(part.replace(/\D.*$/u, '')) || 0);
const compare = (a: string, b: string): number => { const left = parts(a); const right = parts(b); for (let index = 0; index < Math.max(left.length, right.length); index += 1) { const difference = (left[index] ?? 0) - (right[index] ?? 0); if (difference !== 0) return difference; } return 0; };
export const compatibleWithFolio = (manifest: FolioPluginManifest, folioVersion: string): boolean => (manifest.folioVersion?.min === undefined || compare(folioVersion, manifest.folioVersion.min) >= 0) && (manifest.folioVersion?.max === undefined || compare(folioVersion, manifest.folioVersion.max) <= 0);
export function defaultSettings(settings: readonly FolioPluginSetting[] | undefined): Readonly<Record<string, string | boolean | number>> { return Object.fromEntries((settings ?? []).flatMap((setting) => setting.default === undefined ? [] : [[setting.id, setting.default]])); }
export function packageDescriptor(manifest: FolioPluginManifest): { readonly format: 'folio-plugin-package-v1'; readonly id: string; readonly version: string; readonly entry: string } { return { format: 'folio-plugin-package-v1', id: manifest.id, version: manifest.version, entry: manifest.entry }; }
