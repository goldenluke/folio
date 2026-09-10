# ADR 0075 — E2EE para provider de sync comercial

## Decisão

O provider HTTP da Onda BA é um contrato de transporte; ele não recebe paths
locais, identidade do dispositivo ou credenciais pelo vault. O serviço remoto
armazena registros e tombstones por chave de sync.

O conteúdo de um provider comercial deve ser cifrado no cliente antes do
transporte, com chave de vault independente de token de acesso. A primeira
integração REST permanece deliberadamente sem uma implementação de chaves:
não há derivação de senha, recuperação de conta ou rotação segura suficientes
para prometer E2EE neste marco. Esses fluxos exigem ADR operacional próprio.

## Consequências

O adaptador HTTP fica testável com um `fetch` injetado e não incorpora OAuth,
segredos ou backend. Tombstones e conflitos percorrem o mesmo protocolo que
registros; o servidor não decide merge de Markdown.
