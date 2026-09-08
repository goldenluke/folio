/**
 * Fronteiras arquiteturais fiscalizadas.
 *
 * Estas regras não são estilo — são os invariantes que impedem o núcleo
 * semântico de virar "uma AST da ABNT fantasiada". Ver docs/adr/0004.
 *
 * Os regexes casam tanto o caminho real do workspace (`packages/x/`) quanto o
 * alias do pnpm (`@abnt/x`), porque a resolução pode aparecer de qualquer uma
 * das duas formas dependendo de como o import foi escrito.
 */

/** Casa um package do workspace pelo nome, em qualquer das duas formas. */
const pkg = (name) => `(packages/${name}/|@abnt/${name})`;

/** Casa qualquer package do workspace exceto os listados. */
const anyPkgExcept = (...names) => {
  const alternation = names.join('|');
  return `(packages/(?!(${alternation})/)|@abnt/(?!(${alternation})))`;
};

/** Casa uma camada de processo do desktop pelo diretório. */
const desktop = (layer) => `^apps/desktop/src/${layer}/`;

/** Casa um pacote externo pelo nome, sob qualquer layout de node_modules. */
const externo = (name) => `node_modules/${name}/`;

/** Builtins do Node, com ou sem o prefixo `node:`. */
const nodeBuiltin = '^(node:)?(fs|fs/promises|path|os|crypto|child_process|worker_threads|net|http|https)$';

module.exports = {
  forbidden: [
    {
      name: 'document-model-e-folha',
      comment:
        'document-model é a raiz do grafo de dependências. Ele não importa nenhum ' +
        'outro package do workspace. Se precisar importar, o conceito está na ' +
        'camada errada. Ver docs/adr/0001.',
      severity: 'error',
      from: { path: `^${pkg('document-model')}` },
      to: { path: `^${anyPkgExcept('document-model')}` },
    },
    {
      name: 'source-composition-e-folha',
      comment:
        'F66: mapeia fonte virtual composta de volta a arquivo+offset autorais. ' +
        'Não conhece WorkspaceFileId, vault, protocolo nem Document AST — só ' +
        'offsets e caminhos como string, para poder ser consumido tanto por ' +
        'markdown (que monta o mapa) quanto por workspace-environment (que ' +
        'traduz path para identidade do vault). Ver ADR 0054.',
      severity: 'error',
      from: { path: `^${pkg('source-composition')}` },
      to: { path: `^${anyPkgExcept('source-composition')}` },
    },
    {
      name: 'workspace-core-e-folha',
      comment:
        'workspace-core define identidade, revisões e contrato de storage. Ele não ' +
        'conhece Node, protocolo, compiler ou uma implementação de filesystem.',
      severity: 'error',
      from: { path: `^${pkg('workspace-core')}` },
      to: { path: `^${anyPkgExcept('workspace-core')}` },
    },
    {
      name: 'workspace-local-so-implementa-core',
      comment:
        'O adaptador local pode importar APIs Node e workspace-core, mas não compiler, ' +
        'normas, renderers, protocolo ou UI.',
      severity: 'error',
      from: { path: `^${pkg('workspace-local')}` },
      to: { path: `^${anyPkgExcept('workspace-local', 'workspace-core')}` },
    },
    {
      name: 'workspace-index-so-projeta-o-vault',
      comment:
        'workspace-index pode conhecer o storage abstrato, Markdown e Document AST, ' +
        'mas não compiler, protocolo, normas, renderers ou UI.',
      severity: 'error',
      from: { path: `^${pkg('workspace-index')}` },
      to: { path: `^${anyPkgExcept('workspace-index', 'workspace-core', 'document-model', 'markdown')}` },
    },
    {
      name: 'workspace-sessions-so-orquestra-fronteiras',
      comment:
        'Sessões são uma camada de aplicação: coordenam storage abstrato e o ' +
        'contrato do compiler, mas não podem alcançar filesystem, normas, renderers ou UI.',
      severity: 'error',
      from: { path: `^${pkg('workspace-sessions')}` },
      to: { path: `^${anyPkgExcept('workspace-sessions', 'workspace-core', 'protocol', 'source-composition')}` },
    },
    {
      name: 'language-service-so-consome-fontes-e-projecoes',
      comment:
        'Language service combina parser, sessões e índice, mas não conhece UI, ' +
        'filesystem Node, renderer ou norma. CodeMirror e LSP serão adaptadores acima dele.',
      severity: 'error',
      from: { path: `^${pkg('language-service')}` },
      to: {
        path: `^${anyPkgExcept('language-service', 'document-model', 'markdown', 'workspace-core', 'workspace-index', 'workspace-sessions')}`,
      },
    },
    {
      name: 'workspace-environment-so-resolve-dependencias-autorais',
      comment:
        'Resolve bibliografia (e futuramente recursos) declarada no frontmatter, via ' +
        'WorkspaceStorage e delega a expansão de transclusões ao parser de fonte puro. É host-adapter, não compilação: não conhece semântica, ' +
        'semantics, standards nem compiler. Extraído de apps/desktop em P13 para o ' +
        'LSP reaproveitar sem duplicar. Ver docs/adr/0017 e 0018.',
      severity: 'error',
      from: { path: `^${pkg('workspace-environment')}` },
      to: {
        path: `^${anyPkgExcept('workspace-environment', 'bibliography', 'document-model', 'language-service', 'markdown', 'protocol', 'source-composition', 'workspace-core', 'workspace-sessions')}`,
      },
    },
    {
      name: 'workspace-graph-e-projecao-pura',
      comment:
        'Grafo (nodes/edges de documentos, referências, recursos e pessoas) é ' +
        'derivado de workspace-index + bibliografia resolvida (documentTarget de ' +
        'language-service), nunca uma segunda fonte de verdade. Não conhece UI, ' +
        'Electron, protocolo ou SQLite direto — reservado pelo P11 (ADR 0016) ' +
        'como "fatia própria" do grafo.',
      severity: 'error',
      from: { path: `^${pkg('workspace-graph')}` },
      to: {
        path: `^${anyPkgExcept('workspace-graph', 'workspace-core', 'document-model', 'language-service', 'workspace-index')}`,
      },
    },
    {
      name: 'editor-core-so-controla-estado-editorial',
      comment:
        'editor-core coordena sessões e language service, mas não pode importar ' +
        'CodeMirror, React, Electron, filesystem, renderers ou normas.',
      severity: 'error',
      from: { path: `^${pkg('editor-core')}` },
      to: { path: `^${anyPkgExcept('editor-core', 'language-service', 'workspace-core', 'workspace-sessions')}` },
    },
    {
      name: 'editor-codemirror-e-adaptador-visual',
      comment:
        'editor-codemirror traduz EditorController para CodeMirror. Ele não acessa ' +
        'sessões, storage, índice, Electron ou normas diretamente.',
      severity: 'error',
      from: { path: `^${pkg('editor-codemirror')}` },
      to: { path: `^${anyPkgExcept('editor-codemirror', 'editor-core', 'language-service')}` },
    },
    {
      name: 'nucleo-nao-depende-do-indice',
      comment:
        'SQLite é cache descartável. Nenhuma camada de domínio, compiler ou storage ' +
        'pode depender dele; somente hosts e camadas de produto podem fazê-lo.',
      severity: 'error',
      from: {
        path:
          `^(${pkg('document-model')}|${pkg('markdown')}|${pkg('bibliography')}|${pkg('semantics')}|${pkg('publication')}|${pkg('standards')}|${pkg('compiler')}|${pkg('protocol')}|${pkg('workspace-core')}|${pkg('workspace-local')}|${pkg('source-composition')}|${pkg('structural-diff')}|packages/renderer-)`,
      },
      to: { path: `^${pkg('workspace-index')}` },
    },
    {
      name: 'standards-nao-conhece-sintaxe-nem-saida',
      comment:
        'O motor de normas opera sobre o modelo semântico resolvido. Ele nunca ' +
        'vê Markdown (entrada) nem HTML (saída). Se uma regra ABNT precisa olhar ' +
        'a sintaxe original, ela precisa de uma anotação vinda do semantics.',
      severity: 'error',
      from: { path: `^${pkg('standards')}` },
      to: { path: `^(${pkg('markdown')}|${pkg('renderer-html')})` },
    },
    {
      name: 'renderer-so-ve-publication',
      comment:
        'Renderers são burros de propósito. Recebem Publication AST com tudo já ' +
        'resolvido: numeração calculada, citações formatadas, referências ordenadas. ' +
        'Um renderer que importa standards está reimplementando a norma.',
      severity: 'error',
      from: { path: '^packages/renderer-' },
      to: {
        path: `^(${pkg('markdown')}|${pkg('standards')}|${pkg('semantics')}|${pkg('bibliography')})`,
      },
    },
    {
      name: 'structural-diff-so-compara-documentos',
      comment:
        'F70: compara duas revisões de um documento em linguagem editorial. Só ' +
        'precisa parsear (document-model/markdown) — nunca normas, protocolo, ' +
        'workspace ou renderers. Um diff que importasse standards estaria ' +
        'validando a revisão, não comparando; isso é o Requirement Checklist (F50).',
      severity: 'error',
      from: { path: `^${pkg('structural-diff')}` },
      to: { path: `^${anyPkgExcept('structural-diff', 'document-model', 'markdown')}` },
    },
    {
      name: 'markdown-nao-conhece-normas',
      comment:
        'O parser produz estrutura, não julgamento. Nenhuma regra ABNT no parser.',
      severity: 'error',
      from: { path: `^${pkg('markdown')}` },
      to: { path: `^(${pkg('standards')}|${pkg('publication')}|packages/renderer-)` },
    },
    {
      name: 'compiler-headless',
      comment:
        'O compiler compõe apenas o domínio. I/O, renderização e shell de desktop ' +
        'pertencem ao host para que CLI, editor e language service reutilizem a mesma API.',
      severity: 'error',
      from: { path: `^${pkg('compiler')}` },
      to: {
        path:
          '^(apps/|packages/renderer-|node:(fs|fs/promises|path|url|child_process|worker_threads)|electron$|react$)',
      },
    },
    {
      name: 'protocol-nao-importa-implementacoes',
      comment:
        'Protocol é uma fronteira de contratos, não um service locator. Ele só pode ' +
        'conhecer os formatos canônicos que valida e nunca compiler, apps, renderer, ' +
        'standards ou semantics.',
      severity: 'error',
      from: { path: `^${pkg('protocol')}` },
      to: { path: `^${anyPkgExcept('protocol', 'document-model', 'publication')}` },
    },
    {
      name: 'camadas-de-dominio-nao-importam-protocol',
      comment:
        'Protocol é uma borda de aplicação. Modelos, passes, normas e renderers não ' +
        'dependem do transporte; hosts e compiler adaptam para ele na borda.',
      severity: 'error',
      from: {
        path:
          `^(${pkg('document-model')}|${pkg('markdown')}|${pkg('bibliography')}|${pkg('semantics')}|${pkg('publication')}|${pkg('standards')}|${pkg('source-composition')}|${pkg('structural-diff')}|packages/renderer-)`,
      },
      to: { path: `^${pkg('protocol')}` },
    },
    {
      name: 'camadas-inferiores-nao-importam-compiler',
      comment:
        'Compiler é uma camada de orquestração. Nenhum modelo, pass, norma ou renderer ' +
        'pode depender dela, ou a fronteira se inverte e cria ciclos.',
      severity: 'error',
      from: {
        path:
          `^(${pkg('document-model')}|${pkg('markdown')}|${pkg('bibliography')}|${pkg('semantics')}|${pkg('publication')}|${pkg('standards')}|${pkg('source-composition')}|${pkg('structural-diff')}|packages/renderer-)`,
      },
      to: { path: `^${pkg('compiler')}` },
    },
    {
      name: 'plugin-api-so-conhece-protocol',
      comment:
        'plugin-api é o contrato entre um plugin de lint de terceiros e o processo ' +
        'que o hospeda. Só conhece @abnt/protocol (DTOs serializáveis) — nunca ' +
        'markdown, standards, semantics ou compiler. Um plugin lê o documento já ' +
        'resolvido; não reimplementa a norma. Ver ADR 0020.',
      severity: 'error',
      from: { path: `^${pkg('plugin-api')}` },
      to: { path: `^${anyPkgExcept('plugin-api', 'protocol')}` },
    },
    {
      name: 'plugin-host-e-so-transporte-isolado',
      comment:
        'plugin-host sobe o processo do plugin e troca DTOs validados; document-model ' +
        'só para restaurar os brands de Diagnostic (NodeId/DocumentId) que atravessam ' +
        'o IPC como string solta. Nunca markdown, standards, semantics, compiler ou ' +
        'renderer — quem decide o que fazer com o diagnóstico é o host de verdade ' +
        '(CLI/desktop), não este package. Ver ADR 0020.',
      severity: 'error',
      from: { path: `^${pkg('plugin-host')}` },
      to: { path: `^${anyPkgExcept('plugin-host', 'plugin-api', 'protocol', 'document-model')}` },
    },
    {
      name: 'renderer-desktop-nao-alcanca-o-sistema',
      comment:
        'O renderer é o último adaptador: React, CodeMirror e DTOs. Ele não abre ' +
        'filesystem, SQLite nem Electron, e não importa domínio de compilação — tudo ' +
        'que precisa do vault passa pela API estreita do preload. É esta regra que ' +
        'impede React de virar uma segunda fonte de verdade. Ver docs/adr/0014.',
      severity: 'error',
      from: { path: desktop('renderer') },
      to: {
        path: [
          nodeBuiltin,
          externo('electron'),
          externo('better-sqlite3'),
          `^(${pkg('workspace-local')}|${pkg('workspace-index')}|${pkg('workspace-sessions')})`,
          `^(${pkg('compiler')}|${pkg('markdown')}|${pkg('semantics')}|${pkg('standards')}|${pkg('bibliography')}|${pkg('publication')})`,
          '^packages/renderer-',
        ].join('|'),
      },
    },
    {
      name: 'main-desktop-supervisiona-e-nao-processa',
      comment:
        'Electron Main cuida de janela, diálogo nativo e ciclo de vida dos serviços. ' +
        'Markdown, semântica, norma, índice, sessões e compilação rodam nos utility ' +
        'processes. Se Main importar domínio, a separação de processos vira decoração ' +
        'e um crash do compilador derruba a aplicação inteira. Ver docs/adr/0014.',
      severity: 'error',
      from: { path: desktop('main') },
      to: {
        path: [
          externo('better-sqlite3'),
          externo('react'),
          `^(${pkg('compiler')}|${pkg('markdown')}|${pkg('semantics')}|${pkg('standards')}|${pkg('bibliography')}|${pkg('publication')}|${pkg('document-model')})`,
          `^(${pkg('workspace-local')}|${pkg('workspace-index')}|${pkg('workspace-sessions')}|${pkg('language-service')}|${pkg('editor-core')}|${pkg('editor-codemirror')})`,
          '^packages/renderer-',
        ].join('|'),
      },
    },
    {
      name: 'preload-desktop-e-so-ponte',
      comment:
        'O preload existe para transformar ipcRenderer em uma API estreita e validada. ' +
        'Ele não conhece domínio nem serviços; lógica aqui é lógica no lugar errado, ' +
        'e roda no processo mais privilegiado que o renderer consegue tocar.',
      severity: 'error',
      from: { path: desktop('preload') },
      to: {
        path: [nodeBuiltin, externo('better-sqlite3'), externo('react'), `^${anyPkgExcept('protocol')}`].join('|'),
      },
    },
    {
      name: 'compiler-service-desktop-nao-conhece-o-vault',
      comment:
        'O processo do compilador recebe SourceSnapshot serializado e devolve resultado. ' +
        'Ele não abre vault, índice nem sessões — é isso que permite matá-lo e reiniciá-lo ' +
        'sem perder o rascunho do usuário. Ver docs/adr/0014.',
      severity: 'error',
      from: { path: desktop('compiler-service') },
      to: {
        path: [
          externo('electron'),
          externo('better-sqlite3'),
          externo('react'),
          `^(${pkg('workspace-core')}|${pkg('workspace-local')}|${pkg('workspace-index')}|${pkg('workspace-sessions')})`,
        ].join('|'),
      },
    },
    {
      name: 'export-service-desktop-nao-conhece-o-vault',
      comment:
        'O processo de exportação recebe a Publication AST já resolvida e devolve ' +
        'bytes (PDF via renderer-html+renderer-pdf, DOCX via renderer-docx). Não abre ' +
        'vault, índice nem sessões, e não mostra diálogo nem escreve arquivo fora do ' +
        'seu próprio processo — isso é papel do Main, que tem o diálogo nativo de ' +
        'salvar. Isolado porque o caminho de PDF sobe um Chromium real via Puppeteer, ' +
        'que pode travar; um crash aqui não pode levar o Workspace Service junto. ' +
        'Ver ADR 0019.',
      severity: 'error',
      from: { path: desktop('export-service') },
      to: {
        path: [
          externo('electron'),
          externo('better-sqlite3'),
          externo('react'),
          `^(${pkg('workspace-core')}|${pkg('workspace-local')}|${pkg('workspace-index')}|${pkg('workspace-sessions')})`,
        ].join('|'),
      },
    },
    {
      name: 'sqlite-desktop-tem-um-dono-so',
      comment:
        'Só o Workspace Service abre o índice. Duas conexões no mesmo arquivo são duas ' +
        'verdades sobre o vault e corrupção sob escrita concorrente. Ver docs/adr/0009 e 0014.',
      severity: 'error',
      from: { path: '^apps/desktop/src/(?!workspace/)' },
      to: { path: [externo('better-sqlite3'), `^${pkg('workspace-index')}`].join('|') },
    },
    {
      name: 'workspace-desktop-nao-reimplementa-compilacao',
      comment:
        'O host do workspace desktop renderiza preview a partir da Publication AST que ' +
        'a sessão já resolveu (renderer-html) e resolve dependências bibliográficas ' +
        'autorais (bibliography, formatação ABNT) — o mesmo papel de host que ' +
        'apps/cli/src/environment.ts já cumpre para o CLI. Mas não compila: markdown, ' +
        'semantics, standards e compiler continuam isolados no Compiler Service. ' +
        'Importar compiler aqui para "resolver rápido" um bug de preview bypassaria o ' +
        'processo isolado que o P8 existe para garantir. Ver docs/adr/0015 e 0017.',
      severity: 'error',
      from: { path: desktop('workspace') },
      to: {
        path: `^(${pkg('compiler')}|${pkg('markdown')}|${pkg('standards')}|${pkg('semantics')})`,
      },
    },
    {
      name: 'lsp-e-so-adapter-lsp',
      comment:
        'O servidor LSP compõe storage + índice + sessões + language-service num só ' +
        'processo (sem a isolação de crash do desktop, ver docs/adr/0014) e ' +
        'legitimamente usa o compiler in-process, como o CLI. O que ele não tem é ' +
        'motivo para conhecer Markdown, normas ou semântica diretamente — a sessão já ' +
        'delega isso ao compiler — nem UI, Electron ou renderização: LSP não tem ' +
        'preview, só outline, diagnósticos, completions, hover, definição e ' +
        'referências. Ver docs/adr/0018.',
      severity: 'error',
      from: { path: '^apps/lsp/src/' },
      to: {
        path: [
          `^(${pkg('markdown')}|${pkg('standards')}|${pkg('semantics')})`,
          externo('electron'),
          externo('react'),
          externo('better-sqlite3'),
          `^(${pkg('editor-core')}|${pkg('editor-codemirror')})`,
          '^packages/renderer-',
        ].join('|'),
      },
    },
    {
      name: 'ninguem-importa-o-cli',
      comment: 'apps/cli é o topo do grafo. Nada depende dele.',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: '^apps/' },
    },
    {
      name: 'sem-ciclos',
      comment: 'Ciclo de dependência entre módulos.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'sem-orfaos',
      comment: 'Módulo que ninguém importa e que não é entrypoint.',
      severity: 'warn',
      from: {
        orphan: true,
        pathNot: [
          '(^|/)\\.[^/]+\\.(js|cjs|mjs|ts|json)$',
          '\\.d\\.ts$',
          '(^|/)tsconfig\\.json$',
          '(^|/)(package|package-lock)\\.json$',
        ],
      },
      to: {},
    },
  ],

  options: {
    doNotFollow: { path: 'node_modules' },
    // `dist/` é saída de build (bundles do Electron); analisar o bundle não diz
    // nada sobre as fronteiras do código-fonte e ainda gera órfão falso.
    exclude: { path: '(^|/)dist/' },
    // Resolve os symlinks do pnpm para os caminhos reais em packages/,
    // senão as regras acima não casam nada.
    preserveSymlinks: false,
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      // O grafo fiscalizado é o mesmo `src` que TypeScript/Vitest executam;
      // o destino padrão `dist` é artefato de release e fica excluído abaixo.
      conditionNames: ['development', 'import', 'require', 'node', 'default', 'types'],
      extensions: ['.js', '.ts', '.mjs', '.cjs'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
