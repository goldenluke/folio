/**
 * @abnt/workspace-environment — resolve dependências autorais (bibliografia,
 * futuramente recursos) via `WorkspaceStorage`, para qualquer host montar um
 * `CompilationEnvironment` real sem reimplementar essa resolução.
 *
 * Não conhece Electron, LSP, React nem filesystem cru — só `WorkspaceStorage`.
 */
export { criarResolvedorDeAmbienteLocal } from './environment.js';
export { LIBRARY_PATH, readVaultLibrary } from './library.js';
