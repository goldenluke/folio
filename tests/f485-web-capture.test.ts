import { describe, expect, it } from 'vitest';

import {
  citationMetaExtractor,
  doiExtractor,
  dublinCoreExtractor,
  jsonLdExtractor,
  schemaOrgMicrodataExtractor,
  scoreWebCaptureFields,
  WebCaptureExtractorRegistry,
} from '../packages/web-capture/src/index.js';

const CITATION_META_HTML = `<html><head>
<meta name="citation_title" content="Ensino híbrido em ABNT">
<meta name="citation_author" content="Silva, Maria">
<meta name="citation_author" content="Souza, João">
<meta name="citation_journal_title" content="Revista de Educação">
<meta name="citation_publication_date" content="2026/03/15">
<meta name="citation_doi" content="10.1000/exemplo.citation">
<meta name="citation_pdf_url" content="https://example.org/artigo.pdf">
</head><body>Texto.</body></html>`;

const DUBLIN_CORE_HTML = `<html><head>
<meta name="DC.title" content="Repositório institucional">
<meta name="DC.creator" content="Pereira, Ana">
<meta name="DC.publisher" content="Editora Universitária">
<meta name="DC.date" content="2025-11">
<meta name="dcterms.identifier" content="https://doi.org/10.1000/exemplo.dc">
</head><body></body></html>`;

const SCHEMA_ORG_HTML = `<html><body>
<div itemscope itemtype="https://schema.org/Article">
  <span itemprop="headline">Notícia sobre pesquisa</span>
  <span itemprop="author">Carlos Mendes</span>
  <meta itemprop="datePublished" content="2024-05-01">
  <span itemprop="publisher">Jornal Acadêmico</span>
</div>
</body></html>`;

const JSON_LD_HTML = `<html><head><script type="application/ld+json">
{"@context":"https://schema.org","@type":"ScholarlyArticle","headline":"Aprendizagem ativa",
"author":[{"@type":"Person","name":"Fernanda Lima"}],"datePublished":"2023-01-10",
"publisher":{"@type":"Organization","name":"Editora X"},"isPartOf":{"name":"Revista Y"},
"description":"Resumo do artigo.","image":"https://example.org/capa.png",
"url":"https://example.org/artigo-json-ld"}
</script></head><body></body></html>`;

const JSON_LD_GRAPH_HTML = `<html><head><script type="application/ld+json">
{"@graph":[{"@type":"BreadcrumbList","name":"Navegação"},{"@type":"Article","headline":"Item do grafo","author":"Autor Único"}]}
</script></head><body></body></html>`;

const DOI_IN_TEXT_HTML = `<html><body><script>var x = "10.9999/nao-e-doi-de-verdade-no-script";</script>
<p>Como citar: https://doi.org/10.1000/exemplo.texto</p></body></html>`;

describe('F485–F495 — Scholarly Web Capture 2.0 (extractors)', () => {
  it('citation-meta: extrai título, autores múltiplos, data, DOI e PDF descoberto', () => {
    const [extraction] = citationMetaExtractor.extract(CITATION_META_HTML, 'https://example.org/artigo');
    expect(extraction).toBeDefined();
    expect(extraction!.fields).toMatchObject({
      title: 'Ensino híbrido em ABNT',
      'container-title': 'Revista de Educação',
      DOI: '10.1000/exemplo.citation',
      author: [{ family: 'Silva', given: 'Maria' }, { family: 'Souza', given: 'João' }],
      issued: { 'date-parts': [[2026, 3, 15]] },
    });
    expect(extraction!.attachments).toEqual([{ kind: 'link', role: 'supplementary', url: 'https://example.org/artigo.pdf', label: 'PDF (citation_pdf_url)' }]);
  });

  it('dublin-core: extrai campos DC.* e detecta DOI dentro de dcterms.identifier', () => {
    const [extraction] = dublinCoreExtractor.extract(DUBLIN_CORE_HTML, 'https://example.org');
    expect(extraction!.fields).toMatchObject({
      title: 'Repositório institucional',
      publisher: 'Editora Universitária',
      author: [{ family: 'Pereira', given: 'Ana' }],
      issued: { 'date-parts': [[2025, 11]] },
      DOI: '10.1000/exemplo.dc',
    });
  });

  it('schema-org: varredura plana de itemprop cobre o caso comum de um item por página', () => {
    const [extraction] = schemaOrgMicrodataExtractor.extract(SCHEMA_ORG_HTML, 'https://example.org');
    expect(extraction!.fields).toMatchObject({
      title: 'Notícia sobre pesquisa',
      publisher: 'Jornal Acadêmico',
      issued: { 'date-parts': [[2024, 5, 1]] },
      author: [{ given: 'Carlos', family: 'Mendes' }],
    });
  });

  it('schema-org: página sem tipo acadêmico reconhecido não produz candidato', () => {
    expect(schemaOrgMicrodataExtractor.extract('<div itemscope itemtype="https://schema.org/Product"><span itemprop="name">X</span></div>', 'https://example.org')).toEqual([]);
  });

  it('json-ld: extrai um nó ScholarlyArticle com anexo de imagem descoberto', () => {
    const [extraction] = jsonLdExtractor.extract(JSON_LD_HTML, 'https://example.org');
    expect(extraction!.fields).toMatchObject({
      title: 'Aprendizagem ativa',
      author: [{ given: 'Fernanda', family: 'Lima' }],
      publisher: 'Editora X',
      'container-title': 'Revista Y',
      abstract: 'Resumo do artigo.',
      URL: 'https://example.org/artigo-json-ld',
    });
    expect(extraction!.attachments).toEqual([{ kind: 'link', role: 'supplementary', url: 'https://example.org/capa.png', label: 'Imagem (JSON-LD)' }]);
  });

  it('json-ld: um bloco @graph com múltiplos nós pode gerar mais de um resultado', () => {
    const extractions = jsonLdExtractor.extract(JSON_LD_GRAPH_HTML, 'https://example.org');
    expect(extractions).toHaveLength(1);
    expect(extractions[0]!.fields).toMatchObject({ title: 'Item do grafo' });
  });

  it('json-ld: bloco malformado é ignorado sem lançar', () => {
    expect(jsonLdExtractor.extract('<script type="application/ld+json">{ isto não é json }</script>', 'https://example.org')).toEqual([]);
  });

  it('doi: varre texto visível ignorando script/style, nunca resolve rede', () => {
    const extractions = doiExtractor.extract(DOI_IN_TEXT_HTML, 'https://example.org');
    expect(extractions).toEqual([{ fields: { DOI: '10.1000/exemplo.texto' }, attachments: [] }]);
  });

  it('scoreWebCaptureFields: registro rico pontua mais que um registro vazio ou parcial', () => {
    expect(scoreWebCaptureFields({})).toBe(0);
    const partial = scoreWebCaptureFields({ title: 'X' });
    const rich = scoreWebCaptureFields({ title: 'X', author: [{ literal: 'Y' }], issued: { 'date-parts': [[2024]] }, DOI: '10.1/x' });
    expect(rich).toBeGreaterThan(partial);
    expect(rich).toBeLessThanOrEqual(1);
  });

  it('WebCaptureExtractorRegistry: agrega candidatos de múltiplos extractors, ordenados por qualidade, um bug isolado não derruba o lote', () => {
    const registry = new WebCaptureExtractorRegistry();
    registry.register(citationMetaExtractor);
    registry.register(doiExtractor);
    registry.register({ id: 'quebrado', extract: () => { throw new Error('boom'); } });
    const candidates = registry.extract(CITATION_META_HTML, 'https://example.org/artigo');
    expect(candidates.length).toBeGreaterThanOrEqual(1);
    expect(candidates[0]!.extractorId).toBe('citation-meta');
    for (let index = 1; index < candidates.length; index += 1) expect(candidates[index]!.quality).toBeLessThanOrEqual(candidates[index - 1]!.quality);
  });

  it('WebCaptureExtractorRegistry: página sem nenhum formato reconhecido não produz candidatos', () => {
    const registry = new WebCaptureExtractorRegistry();
    registry.register(citationMetaExtractor);
    registry.register(dublinCoreExtractor);
    registry.register(schemaOrgMicrodataExtractor);
    registry.register(jsonLdExtractor);
    registry.register(doiExtractor);
    expect(registry.extract('<html><body><p>Página comum, sem metadados.</p></body></html>', 'https://example.org')).toEqual([]);
  });
});
