import type { BuildChannel, SystemInformationDto } from '@abnt/protocol';

/** Arquivo estático incluído tanto no `dist` de desenvolvimento quanto no artefato empacotado. */
export const BUILD_INFORMATION_FILE = 'build-info.json';

export interface BuildInformationInput {
  readonly appVersion: string;
  readonly commit: string;
  readonly channel: BuildChannel;
  readonly platform: string;
  readonly architecture: string;
  readonly electronVersion: string;
  readonly protocolVersion: number;
  readonly workspaceConfigSchemaVersion: number;
  readonly workspaceStateSchemaVersion: number;
  readonly workspaceIndexSchemaVersion: number;
  readonly pluginApiVersion: number;
}

/**
 * Constrói uma projeção pública e serializável da build. Paths, conteúdo,
 * configuração e qualquer identidade do vault ficam deliberadamente fora.
 */
export const createBuildInformation = (input: BuildInformationInput): SystemInformationDto => ({
  schemaVersion: 1,
  product: 'Folio',
  ...input,
});

export const buildChannelFromEnvironment = (value: string | undefined): BuildChannel => {
  const channel = value?.trim() || 'development';
  if (channel === 'development' || channel === 'preview' || channel === 'stable') return channel;
  throw new Error(`Canal de build inválido: ${channel}. Use development, preview ou stable.`);
};
