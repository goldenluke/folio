# ADR 0063 — Captura e inbox de pesquisa

**Status:** aceito · 2026-09-09

## Decisão

- O intake é uma camada operacional local (`folio.reference-inbox:<vault>`),
  separada de `references/library.json`. Candidatos podem ser descartados ou
  revisados sem deixar bibliografia publicada incompleta.
- Adaptadores de BibTeX, RIS e CSL-JSON convergem em `BibliographicEntity`.
  DOI continua sendo resolvido pelo adapter do Workspace Service; URL HTTP(S)
  só cria um candidato `webpage`, sem scraping de páginas arbitrárias.
- PDF é recebido por drop como dado explícito do usuário. O cliente calcula
  SHA-256 e procura somente um DOI literalmente presente nos bytes; não há OCR
  e a ausência de metadata é informada, não preenchida por inferência. Após a
  confirmação, os bytes atravessam Main e `attachReferencePdf`, que continua
  sendo a única autoridade que cria o anexo no vault.
- Antes de promover um candidato, a UI usa a mesma heurística pura de F53 para
  exibir DOI/ISBN/título/autor-ano que coincidem com a biblioteca canônica.
  O usuário decide criar a entrada ou anexar o PDF ao registro existente. A
  confirmação adiciona a referência à fila de leitura operacional.

## Consequências

O fluxo PDF → DOI → metadata → duplicata → confirmação → anexo/fila não
duplica a bibliografia. A inbox não é uma nova fonte autoral, e PDFs que ainda
não foram confirmados permanecem somente na sessão de intake: fechar a sessão
exige importá-los novamente, evitando persistir bytes grandes e não revisados
em `localStorage`. Uma futura política de portabilidade/sync deverá classificar
explicitamente a inbox e a fila antes de transferi-las entre máquinas.
