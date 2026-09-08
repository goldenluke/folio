# ADR 0040 — Intercâmbio bibliográfico e DOI como adapters

**Status:** aceito · 2026-09-08

## Decisão

BibTeX, RIS, CSL-JSON e DOI convergem para `BibliographicEntity` CSL-JSON
antes de tocar a biblioteca. DOI usa content negotiation em `doi.org` para
CSL-JSON; o DTO do provedor não atravessa a fronteira de normalização.

O resultado de DOI preenche o editor para revisão explícita, não salva sozinho.
Exportações locais do Zotero entram pelo mesmo importador CSL-JSON/BibTeX/RIS;
não há OAuth, API remota ou sincronização contínua nesta fase.

## Consequências

- todo formato externo usa o mesmo modelo interno e a mesma validação;
- o preview ABNT é formatado no Workspace Service, não no renderer;
- importações válidas são mescladas na biblioteca local-first.
