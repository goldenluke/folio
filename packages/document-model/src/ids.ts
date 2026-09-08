/**
 * Identificadores branded.
 *
 * São `string` em runtime e tipos distintos em compilação. O objetivo é que
 * `getReference(nodeId)` não compile — esse tipo de troca é fácil de fazer e
 * difícil de perceber quando tudo é `string`.
 */

declare const brand: unique symbol;

type Branded<T extends string> = string & { readonly [brand]: T };

export type NodeId = Branded<'NodeId'>;
export type DocumentId = Branded<'DocumentId'>;
export type ReferenceId = Branded<'ReferenceId'>;
export type ResourceId = Branded<'ResourceId'>;
export type NoteId = Branded<'NoteId'>;

export const asNodeId = (value: string): NodeId => value as NodeId;
export const asDocumentId = (value: string): DocumentId => value as DocumentId;
export const asReferenceId = (value: string): ReferenceId => value as ReferenceId;
export const asResourceId = (value: string): ResourceId => value as ResourceId;
export const asNoteId = (value: string): NoteId => value as NoteId;

/**
 * Gerador de NodeId determinístico por documento.
 *
 * Determinístico importa: os golden tests comparam ASTs serializadas, então
 * duas execuções sobre a mesma entrada precisam produzir os mesmos IDs. Um
 * contador por documento resolve isso sem depender de conteúdo (que mudaria
 * o ID de um nó ao editar o vizinho).
 */
export class NodeIdFactory {
  #contador = 0;

  constructor(private readonly prefixo: string = 'n') {}

  proximo(): NodeId {
    this.#contador += 1;
    return asNodeId(`${this.prefixo}${this.#contador}`);
  }
}
