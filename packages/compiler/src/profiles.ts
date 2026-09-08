import type { PublicationProfile } from '@abnt/publication';
import type { ResolvedDocument } from '@abnt/semantics';
import {
  perfilArtigoAbnt,
  perfilArtigoAbntNumerico,
  perfilArtigoWeb,
  perfilTccAbnt,
  validarArtigoAbnt,
  validarSemNorma,
  validarTccAbnt,
  type RelatorioDeValidacao,
} from '@abnt/standards';

import type { CompilationProfileDefinition, CompilationProfileRegistry } from './model.js';

const definition = (
  profile: PublicationProfile,
  validar: (document: ResolvedDocument) => RelatorioDeValidacao,
): CompilationProfileDefinition => ({ profile, validar });

/** Profiles embarcados; hosts futuros podem injetar outro registro. */
export const PERFIL_PADRAO = 'abnt-artigo';

export const PERFIS_PADRAO: Readonly<Record<string, CompilationProfileDefinition>> = {
  'abnt-artigo': definition(perfilArtigoAbnt, validarArtigoAbnt),
  'abnt-artigo-numerico': definition(perfilArtigoAbntNumerico, validarArtigoAbnt),
  'abnt-tcc': definition(perfilTccAbnt, validarTccAbnt),
  'web-article': definition(perfilArtigoWeb, validarSemNorma),
};

export const REGISTRO_DE_PERFIS_PADRAO: CompilationProfileRegistry = {
  defaultProfileId: PERFIL_PADRAO,
  profiles: PERFIS_PADRAO,
};

/** Projeção compatível para hosts que só precisam listar PublicationProfiles. */
export const publicationProfiles = (
  registry: CompilationProfileRegistry = REGISTRO_DE_PERFIS_PADRAO,
): Readonly<Record<string, PublicationProfile>> =>
  Object.fromEntries(
    Object.entries(registry.profiles).map(([name, value]) => [name, value.profile]),
  );
