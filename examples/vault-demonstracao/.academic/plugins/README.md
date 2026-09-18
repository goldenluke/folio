# Plugins oficiais de exemplo

Cada diretório desta pasta é um plugin local completo. Para habilitá-lo em um
vault, copie o diretório para `.academic/plugins/` e abra **Configurações →
Plugins locais → Recarregar** no Folio.

Os plugins não recebem acesso ao DOM, às sessões do editor ou à escrita no
vault. Zotero e Mendeley abrem a inbox de pesquisa já existente com o formato
adequado pré-selecionado; a confirmação de cada referência continua no Folio.

- `zotero-bridge`: exportação CSL-JSON do Zotero.
- `mendeley-bridge`: exportação RIS ou BibTeX do Mendeley.
- `institutional-templates`: guia de templates institucionais para adaptar.
- `scholarly-search`: ponto de partida para provedores acadêmicos explícitos.
- `local-ai`: guia para assistência exclusivamente local, sem credenciais
  enviadas pelo Folio.
