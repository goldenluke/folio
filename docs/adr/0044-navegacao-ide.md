# ADR 0044 — Navegação IDE: histórico, recentes e split de editor

**Status:** aceito · 2026-09-08

Histórico de navegação e arquivos recentes pertencem ao shell do renderer. São
preferências de uso, não conteúdo autoral: o histórico é efêmero (até 100
entradas) e os recentes são persistidos somente em `localStorage`, separados
pelo `workspaceId` e limitados a 12. Ao reabrir um vault, entradas que já não
existem são descartadas.

`Alt+Left` e `Alt+Right` retomam arquivo e seleção sem criar uma entrada nova.
Abrir um arquivo, definition ou referência registra uma posição somente depois
que a seleção relevante foi aplicada.

O split de editores cria duas `EditorViewState` independentes. Cada uma tem
controller e seleção próprios, mas usa o mesmo `fileId`, logo a mesma
`DocumentSession` do Workspace Service. O renderer não cria uma segunda sessão,
não lê filesystem e não ganha autoridade sobre o texto. Atualizações do
controller são projetadas para todas as views daquele arquivo; fechar uma view
só envia `editor.close` quando a última view do arquivo desaparecer.

Seleção pura não cruza o protocolo: é estado local do `RemoteEditorController`.
Ao receber atualização do documento, cada controller conserva seu próprio
cursor, enquanto incorpora o texto e as projeções revisionadas do Workspace
Service.

O split suporta tanto o documento atual nos dois lados quanto dois documentos
distintos. Preview lado a lado continua uma modalidade separada e é desligado
ao iniciar o split de editor. Multi-window permanece explicitamente fora deste
ADR: uma janela adicional não pode criar outra autoridade do workspace.
