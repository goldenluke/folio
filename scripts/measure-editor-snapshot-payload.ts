/**
 * F149 — IPC Payload Optimization. Mede o tamanho real (bytes UTF-8) de um
 * EditorSnapshotDto equivalente ao que cada edição reenvia pelo IPC hoje
 * (ver "Dívida conhecida" no ROADMAP.md e ADR 0014), para decidir com dados
 * — não por suposição — se DTOs de evento leves (F149) valem a complexidade.
 *
 * Uso:
 *   NODE_OPTIONS=--conditions=development tsx scripts/measure-editor-snapshot-payload.ts
 */
import { compilar } from '@abnt/cli';

const WORDS_PER_PAGE = 280;
const paragraph = (index: number): string =>
  `Este é o parágrafo sintético número ${index}. `.repeat(1) +
  'Texto de preenchimento para simular prosa acadêmica real em densidade plausível de palavras por parágrafo. '.repeat(3);

function buildDocument(targetPages: number): string {
  const targetWords = targetPages * WORDS_PER_PAGE;
  const wordsPerParagraph = paragraph(0).split(/\s+/u).length;
  const paragraphsNeeded = Math.ceil(targetWords / wordsPerParagraph);
  const sections = Math.max(4, Math.round(targetPages / 8));
  const paragraphsPerSection = Math.ceil(paragraphsNeeded / sections);
  const lines = ['---', 'title: "Documento sintético"', 'lang: pt-BR', '---', ''];
  let written = 0;
  for (let section = 0; section < sections && written < paragraphsNeeded; section += 1) {
    lines.push(`# Seção ${section + 1}`, '');
    for (let index = 0; index < paragraphsPerSection && written < paragraphsNeeded; index += 1, written += 1) lines.push(paragraph(written), '');
  }
  return lines.join('\n');
}

/** Aproxima EditorSnapshotDto (packages/protocol/src/model.ts) sem depender do Workspace Service real. */
function fakeSnapshot(content: string, sectionCount: number) {
  return {
    fileId: 'file_bench',
    version: 42,
    session: {
      file: { fileId: 'file_bench', path: 'bench.md', revision: 42, contentHash: 'sha256:' + 'a'.repeat(64), mediaType: 'text/markdown' },
      revision: 42,
      content,
      contentHash: 'sha256:' + 'a'.repeat(64),
      dirty: true,
      status: 'idle' as const,
      diagnostics: [],
    },
    selection: { anchor: 120, head: 120 },
    outline: Array.from({ length: sectionCount }, (_unused, index) => ({
      nodeId: `node-${index}`,
      title: `Seção ${index + 1}`,
      depth: 1,
      range: { start: index * 1000, end: index * 1000 + 200 },
    })),
    diagnostics: [],
    previewRevision: 42,
    previewProfileId: 'abnt-artigo',
  };
}

async function main(): Promise<void> {
  console.log('páginas\tconteúdo (KB)\tsnapshot JSON (KB)\toverhead não-conteúdo (KB)');
  for (const pages of [1, 10, 50, 200, 500]) {
    const content = buildDocument(pages);
    const compiled = await compilar(content, { documentId: 'bench.md', revision: 42 });
    const headingCount = Object.values(compiled.ast.document.metadata).length > 0 ? (content.match(/^# /gmu) ?? []).length : 0;
    const snapshot = fakeSnapshot(content, headingCount);
    const contentBytes = Buffer.byteLength(content, 'utf8');
    const snapshotBytes = Buffer.byteLength(JSON.stringify(snapshot), 'utf8');
    console.log(`${pages}\t${(contentBytes / 1024).toFixed(1)}\t${(snapshotBytes / 1024).toFixed(1)}\t${((snapshotBytes - contentBytes) / 1024).toFixed(2)}`);
  }
}

void main();
