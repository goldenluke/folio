# Artigo de demonstração

Exemplo completo, porém pequeno, de artigo acadêmico local-first: metadados,
resumo, palavras-chave, citação, tabela e bibliografia BibTeX.

```bash
node ../../apps/cli/dist/bin.js build artigo.md --format html --out dist
```

Para executar o código-fonte sem build prévio no monorepo:

```bash
NODE_OPTIONS=--conditions=development pnpm exec tsx apps/cli/src/bin.ts build examples/artigo-demonstracao/artigo.md --format html --out dist
```
