/** Sintaxe autoral mínima: um ID numa linha própria imediatamente após o bloco. */
const blockIdPattern = /^\^([A-Za-z][A-Za-z0-9_-]*)\s*$/mu;
export interface AuthoredBlock { readonly id: string; readonly source: string; readonly start: number; readonly end: number; }
export interface BlockReference { readonly path: string; readonly blockId: string; }
export function authoredBlocks(source: string): readonly AuthoredBlock[] {
  const blocks: AuthoredBlock[] = []; let match: RegExpExecArray | null; const expression = new RegExp(blockIdPattern.source, 'gmu');
  while ((match = expression.exec(source)) !== null) { const id = match[1]!; const markerStart = match.index; const before = source.slice(0, markerStart).replace(/\n+$/u, ''); const separator = before.lastIndexOf('\n\n'); const start = separator === -1 ? 0 : separator + 2; blocks.push({ id, source: source.slice(start, markerStart).trimEnd(), start, end: markerStart }); }
  return blocks;
}
export function parseBlockReference(value: string): BlockReference | undefined { const match = /^\[\[([^\]#]+)#\^([A-Za-z][A-Za-z0-9_-]*)\]\]$/u.exec(value.trim()); return match === null ? undefined : { path: match[1]!, blockId: match[2]! }; }
export function blockReference(path: string, blockId: string): string { if (path.trim() === '' || !/^[A-Za-z][A-Za-z0-9_-]*$/u.test(blockId)) throw new Error('Referência de bloco inválida.'); return `[[${path}#^${blockId}]]`; }
/** A resolução recebe o texto do host; o pacote nunca lê filesystem. */
export function transcludeBlock(reference: BlockReference, resolve: (path: string) => string | undefined): AuthoredBlock | undefined { return authoredBlocks(resolve(reference.path) ?? '').find((block) => block.id === reference.blockId); }
export interface ExtractSelection { readonly source: string; readonly start: number; readonly end: number; readonly destinationPath: string; readonly title: string; readonly blockId: string; }
export interface ExtractionPreview { readonly destinationPath: string; readonly newDocument: string; readonly replacement: string; }
export function previewExtractSelection(input: ExtractSelection): ExtractionPreview { const selection = input.source.slice(input.start, input.end).trim(); if (selection === '' || input.destinationPath.trim() === '' || !/^[A-Za-z][A-Za-z0-9_-]*$/u.test(input.blockId)) throw new Error('Seleção para extrair inválida.'); return { destinationPath: input.destinationPath, newDocument: `# ${input.title.trim() || 'Nota'}\n\n${selection}\n^${input.blockId}\n`, replacement: blockReference(input.destinationPath, input.blockId) }; }
export function previewMergeModule(current: string, moduleSource: string, insertionOffset: number): string { if (insertionOffset < 0 || insertionOffset > current.length) throw new Error('Posição de inserção inválida.'); return `${current.slice(0, insertionOffset)}${moduleSource.trim()}\n${current.slice(insertionOffset)}`; }
