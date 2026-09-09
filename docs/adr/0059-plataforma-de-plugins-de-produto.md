# ADR 0059 — Plataforma local de plugins de produto

**Status:** aceito · 2026-09-08

## Decisão

- Plugins locais vivem em `.academic/plugins/<plugin>/` e exigem
  `plugin.json` validado: id, versão, `apiVersion`, entry e capabilities.
  O estado habilitado/desabilitado é operacional e fica em
  `.academic/plugin-state.json`; não entra no Markdown nem no índice SQLite.
- O `PluginHost` continua sendo contenção de crash por processo, não sandbox
  de segurança. Entry, id e versão anunciados precisam coincidir com o
  manifesto antes de qualquer comando, lint ou exportação.
- Comandos e views são declarativos. O renderer registra comandos no único
  `CommandRegistry` e projeta views de texto; nunca executa React, DOM ou
  código de plugin diretamente.
- A API de linguagem inicial é só `language-diagnostics`: recebe o
  `ResolvedDocumentDto` serializável da última compilação bem-sucedida e
  revisionada. Não há acesso ao `WorkspaceLanguageService`, ao filesystem ou
  à sessão mutável. Uma falha resulta em diagnóstico `PLUGIN-FALHA`.
- Exportações recebem somente Publication AST e devolvem conteúdo textual.
  O Main abre o diálogo nativo e escreve o arquivo selecionado; o plugin não
  pode alterar a Document AST nem gravar no vault pelo contrato do Folio.

## Consequências

O filesystem autoral segue sendo a fonte de verdade e SQLite continua
reconstruível. O renderer conhece apenas DTOs validados — sem paths absolutos,
processos Node ou manifests crus. Capabilities futuras (completion, hover,
code actions ou binários de exportação) exigem contratos próprios e nova
decisão de isolamento; não são inferidas de `language-diagnostics`/`export`.
