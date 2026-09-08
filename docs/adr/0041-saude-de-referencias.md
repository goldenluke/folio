# ADR 0041 — Saúde das referências é uma projeção derivada

**Status:** aceito · 2026-09-08

## Decisão

O centro de saúde agrega catálogo bibliográfico vault-wide e
`workspace-index.citations()`: total, citadas, não usadas, chaves ausentes e
entradas sem DOI. Não persiste nenhum desses contadores.

## Consequências

- o resultado acompanha a fonte Markdown/CSL-JSON e pode ser recalculado;
- URLs quebradas ficam adiadas: exigem política de rede, timeout e privacidade
  que não pertencem a esta primeira versão local-first.
