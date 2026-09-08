# ADR 0046 — múltiplas janelas, uma autoridade de workspace

**Data:** 2026-09-08  
**Estado:** aceito

## Contexto

Split editor atende leitura e comparação na mesma janela, mas workflows de
pesquisa também precisam manter documento e biblioteca/leitor em janelas
separadas.

## Decisão

`application.newWindow` cria outro `BrowserWindow` com o mesmo preload e sem
Node integration. Cada renderer restaura o último vault; quando a raiz é a já
ativa, `DesktopWorkspaceServiceHost.open()` retorna a projeção atual dos
arquivos sem descartar storage, índice, sessões, controllers ou subscriptions.

O Main também conta, por `WebContents`, quais `fileId`s cada janela abriu. Um
`editor.close` só alcança o Workspace Service quando a última janela libera o
arquivo (o fechamento físico da janela aplica a mesma regra).

O Main continua dono somente de janelas/IPC. O Workspace Service continua a
única autoridade para o vault e todos os eventos operacionais são transmitidos
para todas as janelas.

## Consequências

- Não existe uma sessão por janela e `View != Session` continua verdadeiro.
- Abrir nova janela não reinicia compilações nem perde rascunhos da primeira.
- Trocar de vault enquanto há várias janelas continua uma decisão global de
  produto e não cria uma segunda autoridade escondida.
