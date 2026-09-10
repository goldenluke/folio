# ADR 0080 — Web Capture: registry explícito, não plugin-host

## Contexto

Onda BN (F485–F495) pede um "registry de extractors próprios para
Schema.org, citation meta, Dublin Core, JSON-LD e DOI" e diz que
"extractors específicos vivem em plugin; não incorporar translators do
Zotero." A leitura óbvia seria estender `@abnt/plugin-api`/`plugin-host`
(processo isolado via `child_process.fork`, usado hoje só para lint de
terceiros) com uma nova capacidade de extração. Isso exigiria: um novo
`FolioPluginCapability`, novas mensagens `abnt-plugin/extract`/`-result`
carregando HTML/URL para dentro e candidatos para fora, e um consumidor no
host para orquestrar isso — tudo isso para 5 formatos que são padrões
abertos (meta tags, microdados, JSON-LD), não scraping por site.

## Decisão

`@abnt/web-capture` segue o mesmo padrão de `IdentifierResolverRegistry`
(Onda BF) e `FullTextDiscoveryRegistry` (Onda BI): uma classe
`WebCaptureExtractorRegistry` com `.register(extractor)`, e os 5 extractors
embutidos são funções puras exportadas pelo próprio pacote — o host
(`apps/desktop/src/workspace/web-capture.ts`) é quem os registra
explicitamente em `buildWebCaptureRegistry()`, nunca uma lista hardcoded
dentro do pacote. É esse `.register()` que realiza "extractors específicos
vivem em plugin": hoje só o host chama; nada impede um plugin (via
`plugin-host`, se e quando `@abnt/plugin-api` ganhar uma capacidade de
extração) de registrar um extractor adicional depois, sem tocar em
`@abnt/web-capture` nem no host. "Não incorporar translators do Zotero" é
sobre isso: não embutir centenas de scrapers site-a-site no núcleo — os 5
extractors desta onda leem formatos padronizados (`citation_*`, `DC.*`,
`itemprop`, `application/ld+json`), não HTML arbitrário de um site
específico.

Cada extractor é uma função `(html, pageUrl) => WebCaptureExtraction[]`
sem I/O — quem busca a página é `fetchPageHtml()`
(`apps/desktop/src/workspace/web-capture.ts`), mesmo template de
`resolveDoi`/`fetchFeedItems` (fetcher injetável, teto de tamanho). Um
extractor com bug é isolado por `try/catch` dentro do registry — nunca
derruba o lote inteiro, mesma régua de `Promise.allSettled` na Onda BI.
Qualidade é pontuação determinística por soma ponderada de campos
preenchidos (`scoreWebCaptureFields`), calculada pelo registry, não
auto-relatada por cada extractor — garante que candidatos de fontes
diferentes sejam comparáveis pelo mesmo critério.

## Consequências

Se um extractor de verdade específico de site vier a ser necessário no
futuro (ex.: um repositório institucional com HTML idiossincrático), o
caminho natural é estendê-lo como plugin de verdade — o que exige então dar
ao `plugin-host` uma capacidade de extração real (nova entrada em
`FolioPluginCapability`, novas mensagens no protocolo interno de plugin).
Essa extensão não foi construída nesta onda porque nenhum dos 5 formatos
cobertos precisa de isolamento de processo: são parsers determinísticos
sobre texto já confiável (a página HTML buscada pelo próprio host), não
código de terceiro em execução. Enriquecimento por DOI
(`webCaptureExtract` no host, quando um candidato tem campo `DOI`) chama
`resolveDoi` (F8) e substitui os campos pelo CSL-JSON real do provider,
nunca inventa metadata própria — mesma disciplina de proveniência que
percorre F8, BF, BG e BM.
