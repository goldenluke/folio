import type { PublicationProfile } from '@abnt/publication';
import type { ResolvedDocument } from '@abnt/semantics';
import {
  perfilArtigoAbnt,
  perfilArtigoAbntNumerico,
  perfilArtigoWeb,
  perfilArtigoApa,
  REGRAS_DO_ARTIGO_APA,
  validarArtigoApa,
  perfilTccAbnt,
  REGRAS_DO_ARTIGO_ABNT,
  REGRAS_DO_TCC_ABNT,
  validarArtigoAbnt,
  validarSemNorma,
  validarTccAbnt,
  type RelatorioDeValidacao,
} from '@abnt/standards';

import type { CompilationProfileDefinition, CompilationProfileRegistry, InstitutionalProfileComposition, PublicationProfileManifest } from './model.js';

const definition = (
  profile: PublicationProfile,
  validar: (document: ResolvedDocument) => RelatorioDeValidacao,
  manifest: PublicationProfileManifest,
): CompilationProfileDefinition => ({ profile, validar, manifest });

const articleRules = REGRAS_DO_ARTIGO_ABNT.map((rule) => ({ id: rule.id, standard: `${rule.norma.id}@${rule.norma.version}`, description: `Validação editorial ${rule.id}.` }));
const tccRules = REGRAS_DO_TCC_ABNT.map((rule) => ({ id: rule.id, standard: `${rule.norma.id}@${rule.norma.version}`, description: `Validação editorial ${rule.id}.` }));
const apaRules = REGRAS_DO_ARTIGO_APA.map((rule) => ({ id: rule.id, standard: `${rule.norma.id}@${rule.norma.version}`, description: `Validação editorial ${rule.id}.` }));
const articleCapabilities = ['abstract', 'keywords', 'numbered-sections', 'figures', 'tables', 'equations', 'bibliography', 'lists', 'posttextual'] as const;
const tccCapabilities = [...articleCapabilities, 'toc', 'pretextual'] as const;

const composeInstitutionalProfile = (
  base: CompilationProfileDefinition,
  composition: InstitutionalProfileComposition,
): CompilationProfileDefinition => {
  const margin = { ...base.profile.page.margin, ...composition.margin };
  const profile: PublicationProfile = { ...base.profile, id: `institutional:${composition.id}@${composition.version}`, page: { ...base.profile.page, margin } };
  return {
    profile,
    validar: base.validar,
    manifest: {
      ...base.manifest,
      id: composition.id,
      version: composition.version,
      name: composition.name,
      description: composition.description,
      requiredMetadata: composition.requiredMetadata ?? base.manifest.requiredMetadata,
      pagePolicy: profile.page,
      composition: { baseProfileId: composition.baseProfileId, overrides: [
        ...(composition.margin === undefined ? [] : ['page.margin']),
        ...(composition.requiredMetadata === undefined ? [] : ['requiredMetadata']),
      ] },
    },
  };
};

/** Profiles embarcados; hosts futuros podem injetar outro registro. */
export const PERFIL_PADRAO = 'abnt-artigo';

export const PERFIS_PADRAO: Readonly<Record<string, CompilationProfileDefinition>> = {
  'abnt-artigo': definition(perfilArtigoAbnt, validarArtigoAbnt, { id: 'abnt-artigo', version: '2018.1', name: 'ABNT Artigo', description: 'Artigo acadêmico conforme o profile ABNT do Folio.', documentKinds: ['article'], citationSystem: 'ABNT autor-data', capabilities: articleCapabilities, requiredMetadata: ['title', 'authors', 'abstract', 'keywords'], optionalMetadata: ['subtitle', 'language', 'bibliography'], rules: articleRules, pagePolicy: perfilArtigoAbnt.page }),
  'abnt-artigo-numerico': definition(perfilArtigoAbntNumerico, validarArtigoAbnt, { id: 'abnt-artigo-numerico', version: '2018.1', name: 'ABNT Artigo numérico', description: 'Artigo ABNT com sistema de citação numérico.', documentKinds: ['article'], citationSystem: 'ABNT numérico', capabilities: articleCapabilities, requiredMetadata: ['title', 'authors', 'abstract', 'keywords'], optionalMetadata: ['subtitle', 'language', 'bibliography'], rules: articleRules, pagePolicy: perfilArtigoAbntNumerico.page }),
  'abnt-tcc': definition(perfilTccAbnt, validarTccAbnt, { id: 'abnt-tcc', version: '2011.1', name: 'ABNT TCC', description: 'Trabalho acadêmico com elementos pré e pós-textuais.', documentKinds: ['tcc', 'dissertation', 'thesis'], citationSystem: 'ABNT autor-data', capabilities: tccCapabilities, requiredMetadata: ['title', 'authors', 'tcc:institution', 'tcc:course', 'tcc:place', 'tcc:year', 'tcc:nature'], optionalMetadata: ['abstract', 'keywords', 'tcc:advisor', 'tcc:approval-date'], rules: tccRules, pagePolicy: perfilTccAbnt.page }),
  'web-article': definition(perfilArtigoWeb, validarSemNorma, { id: 'web-article', version: '1.0.0', name: 'Web Article', description: 'Artigo para publicação web, sem validação normativa ABNT.', documentKinds: ['article', 'web'], citationSystem: 'Web author-date', capabilities: articleCapabilities, requiredMetadata: ['title'], optionalMetadata: ['authors', 'abstract', 'keywords', 'language'], rules: [], pagePolicy: perfilArtigoWeb.page }),
  'apa-7': definition(perfilArtigoApa, validarArtigoApa, { id: 'apa-7', version: '7.0.0', name: 'APA 7', description: 'Artigo acadêmico conforme APA 7, com citações autor-data e referências em inglês.', documentKinds: ['article'], citationSystem: 'APA 7 author-date', capabilities: articleCapabilities, requiredMetadata: ['title', 'authors', 'abstract'], optionalMetadata: ['keywords', 'language', 'bibliography'], rules: apaRules, pagePolicy: perfilArtigoApa.page }),
};

const institutionalTcc = composeInstitutionalProfile(PERFIS_PADRAO['abnt-tcc']!, {
  id: 'institutional-tcc', version: '1.0.0', name: 'TCC institucional (modelo)',
  description: 'Composição explícita sobre ABNT TCC para configurar decisões institucionais.',
  baseProfileId: 'abnt-tcc', margin: { top: '2.5cm', left: '2.5cm' },
  requiredMetadata: ['title', 'authors', 'tcc:institution', 'tcc:course', 'tcc:place', 'tcc:year', 'tcc:nature'],
});

export const PERFIS_DE_PRODUTO: Readonly<Record<string, CompilationProfileDefinition>> = { ...PERFIS_PADRAO, 'institutional-tcc': institutionalTcc };

export const REGISTRO_DE_PERFIS_PADRAO: CompilationProfileRegistry = {
  defaultProfileId: PERFIL_PADRAO,
  profiles: PERFIS_DE_PRODUTO,
};

export const profileManifests = (registry: CompilationProfileRegistry = REGISTRO_DE_PERFIS_PADRAO): readonly PublicationProfileManifest[] =>
  Object.values(registry.profiles).map((definition) => definition.manifest).sort((left, right) => left.name.localeCompare(right.name));

/** Projeção compatível para hosts que só precisam listar PublicationProfiles. */
export const publicationProfiles = (
  registry: CompilationProfileRegistry = REGISTRO_DE_PERFIS_PADRAO,
): Readonly<Record<string, PublicationProfile>> =>
  Object.fromEntries(
    Object.entries(registry.profiles).map(([name, value]) => [name, value.profile]),
  );
