# ADR 0076 — Integrações de submissão no desktop

## Decisão

O desktop expõe uma superfície para validar ORCID, exportar XML Crossref e
enviar um pacote ao OJS. Crossref continua export-only: registrar um DOI é
uma decisão e um provider separados. OJS usa endpoint, token e `fetch`
fornecidos no momento do envio; o token não é gravado no vault nem nos
registros de projeto.

Status e pedidos de revisão seguem a máquina de estados do pacote
`submission-integrations`; uma transição inválida não é corrigida pela UI.
Artefatos e snapshots continuam pertencendo ao workflow de projetos definido
no ADR 0064.
