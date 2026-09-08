import type { JsonValue, NodeId } from '@abnt/document-model';

/**
 * Chave de anotação, sempre com namespace: `semantic:word-count`.
 * Namespace evita colisão entre passes do core e passes de módulos de norma.
 */
export type AnnotationKey = `${string}:${string}`;

export type NodeAnnotations = { readonly [k in AnnotationKey]?: JsonValue };

/**
 * Dados derivados pelo compilador, guardados FORA da AST.
 *
 * Esta separação é o que permite a AST ser imutável e cacheável por hash de
 * conteúdo: o mesmo documento sob ABNT e sob APA produz duas annotation stores
 * diferentes e uma única AST compartilhada. Se o número da seção morasse no
 * nó, cada norma precisaria da sua própria cópia da árvore.
 *
 * Regra: `attributes` é o que o autor declarou; `annotations` é o que o
 * compilador concluiu. Anotação nunca é serializada de volta para o Markdown.
 */
export class AnnotationStore {
  readonly #porNo = new Map<NodeId, Map<AnnotationKey, JsonValue>>();

  set(nodeId: NodeId, chave: AnnotationKey, valor: JsonValue): void {
    let doNo = this.#porNo.get(nodeId);
    if (doNo === undefined) {
      doNo = new Map();
      this.#porNo.set(nodeId, doNo);
    }
    doNo.set(chave, valor);
  }

  get(nodeId: NodeId, chave: AnnotationKey): JsonValue | undefined {
    return this.#porNo.get(nodeId)?.get(chave);
  }

  getString(nodeId: NodeId, chave: AnnotationKey): string | undefined {
    const v = this.get(nodeId, chave);
    return typeof v === 'string' ? v : undefined;
  }

  getNumber(nodeId: NodeId, chave: AnnotationKey): number | undefined {
    const v = this.get(nodeId, chave);
    return typeof v === 'number' ? v : undefined;
  }

  doNo(nodeId: NodeId): NodeAnnotations {
    const doNo = this.#porNo.get(nodeId);
    if (doNo === undefined) return {};
    return Object.fromEntries(doNo) as NodeAnnotations;
  }

  /** Forma serializável, para golden tests e debug. */
  toJSON(): Record<string, Record<string, JsonValue>> {
    const saida: Record<string, Record<string, JsonValue>> = {};
    for (const [nodeId, doNo] of [...this.#porNo].sort(([a], [b]) => a.localeCompare(b))) {
      saida[nodeId] = Object.fromEntries([...doNo].sort(([a], [b]) => a.localeCompare(b)));
    }
    return saida;
  }
}
