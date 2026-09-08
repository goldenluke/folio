import { readFile } from 'node:fs/promises';

import { validarSystemInformationDto, type SystemInformationDto } from '@abnt/protocol';

/** Falha cedo quando o artefato está incompleto, sem entregar detalhes internos ao renderer. */
export async function loadSystemInformation(path: string): Promise<SystemInformationDto> {
  const raw = JSON.parse(await readFile(path, 'utf8')) as unknown;
  const checked = validarSystemInformationDto(raw);
  if (checked.ok) return checked.value;
  throw new Error('O manifesto de identidade desta build Folio é inválido.');
}
