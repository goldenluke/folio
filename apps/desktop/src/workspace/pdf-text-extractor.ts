/**
 * Extrator local, deliberadamente conservador. PDFs sem camada textual ou com
 * streams comprimidos continuam sem identificador: BG não usa OCR nem inventa
 * metadata para compensar essa limitação.
 */
export function textFromPdfBytes(bytes: Uint8Array): string {
  const raw = Buffer.from(bytes).toString('latin1');
  const strings = [...raw.matchAll(/\((?:\\.|[^\\)])*\)/gu)].map((match) => match[0].slice(1, -1).replace(/\\([()\\])/gu, '$1').replace(/\\n/gu, '\n'));
  return strings.length === 0 ? raw : strings.join('\n');
}

export function textFromPdfBase64(base64: string): string {
  return textFromPdfBytes(Buffer.from(base64, 'base64'));
}
