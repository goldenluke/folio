import type { WorkspaceProblemDto } from '@abnt/protocol';

/**
 * O problema já chega do host remapeado para a autoria. Esta ponte não deduz
 * offsets a partir do documento atualmente aberto: abre exatamente o fileId
 * projetado pelo Workspace Service e só então aplica o range daquele arquivo.
 */
export async function openWorkspaceProblem(
  problem: WorkspaceProblemDto,
  openDocument: (fileId: string, path: string, options: { readonly remember?: boolean }) => Promise<{ dispatch(transaction: { selection: { anchor: number; head: number } }): void } | undefined>,
): Promise<void> {
  const controller = await openDocument(problem.fileId, problem.path, { remember: true });
  if (controller === undefined || problem.range === undefined) return;
  controller.dispatch({ selection: { anchor: problem.range.start, head: problem.range.end } });
}
