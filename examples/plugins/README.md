# Plugins oficiais de exemplo

Cada diretório desta pasta é um plugin local completo. A coleção oficial é
instalada no primeiro carregamento de cada vault em `.academic/plugins/`.
Depois disso, abra **Configurações → Plugins locais → Recarregar** para
habilitar ou desabilitar cada item. Uma pasta já existente nunca é
sobrescrita: o vault continua dono do plugin local.

Os plugins não recebem acesso ao DOM, às sessões do editor ou à escrita no
vault. Zotero e Mendeley abrem a inbox de pesquisa já existente com o formato
adequado pré-selecionado; a confirmação de cada referência continua no Folio.

- `zotero-bridge`: exportação CSL-JSON do Zotero.
- `mendeley-bridge`: exportação RIS ou BibTeX do Mendeley.
- `institutional-templates`: abre o criador nativo para TCC e artigo
  institucionais.
- `scholarly-search`: encaminha identificadores a provedores acadêmicos
  explícitos e revisáveis.
- `local-ai`: abre a assistência exclusivamente local já submetida a
  disclosure e consentimento no Folio.
