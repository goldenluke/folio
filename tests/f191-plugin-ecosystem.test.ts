import { describe, expect, it } from 'vitest';
import { compatibleWithFolio, defaultSettings, folioPluginManifestSchema, packageDescriptor, pluginDataPath, requestedPermissions } from '../packages/plugin-api/src/index.js';

describe('F191–F204 — extensões declarativas', () => {
  const manifest = { id: 'org.exemplo', version: '1.2.0', apiVersion: 1, entry: 'index.js', capabilities: ['commands', 'network', 'read-library'], folioVersion: { min: '0.1.0', max: '1.0.0' }, settings: [{ id: 'source', label: 'Fonte', type: 'enum', options: ['a', 'b'], default: 'a' }], bibliographyAdapters: [{ id: 'ris', title: 'RIS' }], searchProviders: [{ id: 'repo', title: 'Repositório' }], projectContributions: [{ id: 'metric', title: 'Métrica', metric: 'count' }], intakeProviders: [{ id: 'arxiv', title: 'arXiv' }], publicationProfiles: [{ id: 'profile', title: 'Perfil' }], templates: [{ id: 'template', title: 'Template' }] } as const;
  it('valida schema, configurações e permissões explícitas', () => {
    const parsed = folioPluginManifestSchema.parse(manifest);
    expect(defaultSettings(parsed.settings)).toEqual({ source: 'a' });
    expect(requestedPermissions(parsed)).toEqual(['network', 'read-library']);
    expect(pluginDataPath(parsed.id)).toBe('.academic/plugins-data/org.exemplo');
  });
  it('declara compatibilidade e pacote local distribuível', () => {
    const parsed = folioPluginManifestSchema.parse(manifest);
    expect(compatibleWithFolio(parsed, '0.1.0')).toBe(true); expect(compatibleWithFolio(parsed, '1.1.0')).toBe(false);
    expect(packageDescriptor(parsed)).toMatchObject({ format: 'folio-plugin-package-v1', id: 'org.exemplo' });
  });
});
