/**
 * Identidade de um addon nativo privado do runtime Electron.
 *
 * Não é estado do vault nem contrato de produto: acompanha somente o artefato
 * `dist/workspace`, para impedir que um `.node` compilado para outro runtime
 * seja aceito silenciosamente.
 */
export interface NativeAddonManifest {
  readonly schemaVersion: 1;
  readonly product: 'Folio';
  readonly platform: 'linux' | 'win32';
  readonly architecture: 'x64';
  readonly electronVersion: string;
  readonly electronModuleAbi: string;
  readonly betterSqlite3Version: string;
  readonly lockfileSha256: string;
  readonly cacheKey: string;
}

export const NATIVE_MANIFEST_FILE = 'native-addon.json';

export const OFFICIAL_NATIVE_TARGETS = [
  {
    platform: 'linux',
    architecture: 'x64',
    runner: 'ubuntu-22.04',
    tier: 1,
  },
  {
    platform: 'win32',
    architecture: 'x64',
    runner: 'windows-2022',
    tier: 1,
  },
] as const;

export function nativeTargetId(platform: string, architecture: string): string {
  return `${platform}-${architecture}`;
}

export function nativeCacheKey(input: Omit<NativeAddonManifest, 'schemaVersion' | 'product' | 'cacheKey'>): string {
  return [
    'folio-native',
    nativeTargetId(input.platform, input.architecture),
    `electron-${input.electronVersion}`,
    `sqlite-${input.betterSqlite3Version}`,
    `abi-${input.electronModuleAbi}`,
    `lock-${input.lockfileSha256.slice(0, 16)}`,
  ].join('-');
}

export function createNativeAddonManifest(
  input: Omit<NativeAddonManifest, 'schemaVersion' | 'product' | 'cacheKey'>,
): NativeAddonManifest {
  return {
    schemaVersion: 1,
    product: 'Folio',
    ...input,
    cacheKey: nativeCacheKey(input),
  };
}

export interface NativeRuntimeIdentity {
  readonly platform: string;
  readonly architecture: string;
  readonly electronVersion: string | undefined;
  readonly electronModuleAbi: string | undefined;
}

/** Retorna uma causa apresentável ao host, sem tentar carregar o binding. */
export function nativeManifestMismatch(
  manifest: NativeAddonManifest,
  runtime: NativeRuntimeIdentity,
): string | undefined {
  if (manifest.schemaVersion !== 1 || manifest.product !== 'Folio') return 'manifesto nativo inválido';
  if (runtime.platform !== manifest.platform || runtime.architecture !== manifest.architecture) {
    return `target ${nativeTargetId(manifest.platform, manifest.architecture)} não corresponde ao runtime ${nativeTargetId(runtime.platform, runtime.architecture)}`;
  }
  if (runtime.electronVersion !== manifest.electronVersion) {
    return `Electron ${manifest.electronVersion} esperado, ${runtime.electronVersion ?? 'ausente'} encontrado`;
  }
  if (runtime.electronModuleAbi !== manifest.electronModuleAbi) {
    return `ABI ${manifest.electronModuleAbi} esperado, ${runtime.electronModuleAbi ?? 'ausente'} encontrado`;
  }
  return undefined;
}
