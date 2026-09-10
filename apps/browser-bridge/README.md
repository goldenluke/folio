# Folio Browser Bridge

No Chromium, abra `chrome://extensions`, ative o modo de desenvolvedor e use
**Carregar sem compactação** apontando para esta pasta. Com o Folio aberto,
use o menu de contexto **Capturar no Folio** em uma página ou seleção.

A extensão só faz um `POST` para `127.0.0.1:38373` com URL, título e seleção.
Ela não recebe caminho do vault, token, acesso a arquivos nem poder de criar
referências ou notas: o Folio apresenta a captura para confirmação antes de
persisti-la.
