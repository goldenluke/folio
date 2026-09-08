import type {
  BlockNode,
  Caption,
  DocumentAst,
  ListItemNode,
  TableCell,
  TableRow,
} from '@abnt/document-model';

/** Mapeia preservando a referência do array quando nenhum item muda. */
function mapearSeMudou<T>(itens: readonly T[], f: (item: T) => T): readonly T[] {
  let mudou = false;
  const saida = itens.map((item) => {
    const novo = f(item);
    if (novo !== item) mudou = true;
    return novo;
  });
  return mudou ? saida : itens;
}

function normalizarCaption(caption: Caption | undefined): Caption | undefined {
  if (caption?.long === undefined) return caption;
  const long = normalizarBlocos(caption.long);
  return long === caption.long ? caption : { ...caption, long };
}

function normalizarCelula(celula: TableCell): TableCell {
  const children = normalizarBlocos(celula.children);
  return children === celula.children ? celula : { ...celula, children };
}

function normalizarLinha(linha: TableRow): TableRow {
  const cells = mapearSeMudou(linha.cells, normalizarCelula);
  return cells === linha.cells ? linha : { ...linha, cells };
}

function normalizarItem(item: ListItemNode): ListItemNode {
  const children = normalizarBlocos(item.children);
  return children === item.children ? item : { ...item, children };
}

function normalizarBloco(bloco: BlockNode): BlockNode {
  switch (bloco.type) {
    case 'section':
    case 'quote':
    case 'list-item':
    case 'container': {
      const children = normalizarBlocos(bloco.children);
      return children === bloco.children ? bloco : { ...bloco, children };
    }

    case 'list': {
      const items = mapearSeMudou(bloco.items, normalizarItem);
      // `start` só carrega informação quando a lista é ordenada e começa em
      // valor diferente de 1. As outras formas são equivalentes, portanto
      // convergem para uma representação canônica.
      const startCanonico =
        bloco.ordered && bloco.start !== undefined && bloco.start !== 1
          ? bloco.start
          : undefined;
      const startMudou = startCanonico !== bloco.start;
      if (items === bloco.items && !startMudou) return bloco;

      const { start: _start, ...semStart } = bloco;
      return startCanonico === undefined
        ? { ...semStart, items }
        : { ...semStart, start: startCanonico, items };
    }

    case 'figure': {
      const caption = normalizarCaption(bloco.caption);
      if (caption === bloco.caption || caption === undefined) return bloco;
      return { ...bloco, caption };
    }

    case 'table': {
      const head =
        bloco.head === undefined ? undefined : mapearSeMudou(bloco.head, normalizarLinha);
      const body = mapearSeMudou(bloco.body, normalizarLinha);
      const foot =
        bloco.foot === undefined ? undefined : mapearSeMudou(bloco.foot, normalizarLinha);
      const caption = normalizarCaption(bloco.caption);
      if (
        head === bloco.head &&
        body === bloco.body &&
        foot === bloco.foot &&
        caption === bloco.caption
      ) {
        return bloco;
      }
      return {
        ...bloco,
        ...(head !== undefined ? { head } : {}),
        body,
        ...(foot !== undefined ? { foot } : {}),
        ...(caption !== undefined ? { caption } : {}),
      };
    }

    case 'code-block':
    case 'math-block': {
      const caption = normalizarCaption(bloco.caption);
      if (caption === bloco.caption || caption === undefined) return bloco;
      return { ...bloco, caption };
    }

    case 'paragraph':
    case 'heading':
    case 'thematic-break':
      return bloco;
  }
}

function normalizarBlocos(blocos: readonly BlockNode[]): readonly BlockNode[] {
  return mapearSeMudou(blocos, normalizarBloco);
}

/**
 * Converte formas semanticamente equivalentes numa representação canônica.
 *
 * O passe é puro, idempotente e usa structural sharing: uma AST já normalizada
 * volta pela mesma referência. Isso importa para cache e compilação
 * incremental; normalizar duas vezes não pode inventar uma terceira forma.
 */
export function normalizarDocumento(ast: DocumentAst): DocumentAst {
  const children = normalizarBlocos(ast.document.children);
  const abstract =
    ast.document.metadata.abstract === undefined
      ? undefined
      : normalizarBlocos(ast.document.metadata.abstract);

  let notasMudaram = false;
  const notes = Object.fromEntries(
    Object.entries(ast.notes).map(([id, nota]) => {
      const filhos = normalizarBlocos(nota.children);
      if (filhos !== nota.children) notasMudaram = true;
      return [id, filhos === nota.children ? nota : { ...nota, children: filhos }];
    }),
  );

  if (
    children === ast.document.children &&
    abstract === ast.document.metadata.abstract &&
    !notasMudaram
  ) {
    return ast;
  }

  const metadata =
    abstract === ast.document.metadata.abstract
      ? ast.document.metadata
      : {
          ...ast.document.metadata,
          ...(abstract !== undefined ? { abstract } : {}),
        };

  return {
    ...ast,
    document: {
      ...ast.document,
      metadata,
      children,
    },
    notes: notasMudaram ? notes : ast.notes,
  };
}
