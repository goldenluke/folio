// Plugin de exemplo para @abnt/plugin-api (P15): avisa quando um parágrafo
// excede um número de palavras configurável. Roda isolado no seu próprio
// processo Node (child_process.fork, via @abnt/plugin-host) — não sabe que é
// hospedado, só implementa `lint(document)` e chama `runLintPlugin`.
//
// Uso: abnt lint documento.md --plugin examples/plugins/paragrafo-longo.mjs

import { percorrer } from '@abnt/document-model';
import { runLintPlugin } from '@abnt/plugin-api';

const LIMITE_DE_PALAVRAS = 150;

function textoDoParagrafo(node) {
  const partes = [];
  const andarInline = (inline) => {
    switch (inline.type) {
      case 'text':
      case 'code-inline':
      case 'math-inline':
        partes.push(inline.value);
        return;
      case 'soft-break':
      case 'hard-break':
        partes.push(' ');
        return;
      default:
        if (Array.isArray(inline.children)) inline.children.forEach(andarInline);
    }
  };
  node.children.forEach(andarInline);
  return partes.join(' ');
}

runLintPlugin({
  id: 'exemplo.paragrafo-longo',
  version: '0.1.0',
  lint(document) {
    const diagnosticos = [];
    for (const node of percorrer(document.ast)) {
      if (node.type !== 'paragraph') continue;
      const palavras = textoDoParagrafo(node).split(/\s+/u).filter(Boolean).length;
      if (palavras <= LIMITE_DE_PALAVRAS) continue;
      diagnosticos.push({
        id: 'EXEMPLO-PARAGRAFO-LONGO',
        severity: 'warning',
        message: `Parágrafo com ${palavras} palavras (limite sugerido: ${LIMITE_DE_PALAVRAS}). Considere dividir.`,
        nodeId: String(node.id),
        ...(node.source !== undefined ? { source: node.source } : {}),
      });
    }
    return diagnosticos;
  },
});
