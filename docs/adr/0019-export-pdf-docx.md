# ADR 0019 — Export Service isolado: PDF chega ao desktop, DOCX nasce

**Status:** aceito · 2026-09-07

## Contexto

PDF já existia — mas só no CLI (`apps/cli/src/pdf.ts`), nunca no desktop. O
desktop (P9-P13) tinha preview HTML sob demanda (P10) mas nenhum caminho para
produzir um arquivo final. DOCX não existia em lugar nenhum. Este ciclo junta
os dois: exportação de PDF chega ao desktop, isolada num processo próprio pelo
mesmo motivo que a compilação já é (ADR 0014); DOCX nasce como um renderer
novo sobre a mesma Publication AST que HTML e PDF já consomem.

## Decisão

### `packages/renderer-pdf`: extraído do CLI antes de duplicar no desktop

`apps/cli/src/pdf.ts` (Puppeteer + Paged.js) virou `packages/renderer-pdf`,
sem mudar a lógica — só a assinatura de `gerarPdf`, que agora sempre devolve
os bytes (`page.pdf()` sempre retorna `Uint8Array`, `path` é só um efeito
colateral opcional de gravar em disco). O CLI continua gravando direto; o
Export Service do desktop usa os mesmos bytes para atravessar o MessagePort
até o Main, que tem o diálogo nativo de salvar. Mesmo padrão do P13
(`workspace-environment` extraído antes do LSP existir): nunca construir o
segundo consumidor sobre uma cópia da lógica do primeiro.

### `packages/renderer-docx`: mesma árvore, segunda saída

`renderizarDocx(doc: PublicationDocument): Promise<Buffer>` percorre
exatamente a Publication AST que `renderer-html` já percorre — numeração
resolvida, citações formatadas, referências ordenadas, front-matter com
`label`. Só importa `@abnt/publication` e a lib `docx`; a fronteira
`renderer-so-ve-publication` já cobre qualquer `packages/renderer-*`
automaticamente, sem precisar de regra nova.

Lacunas deliberadas, documentadas em vez de escondidas:
- Matemática (inline e bloco) sai como texto monoespaçado da fonte TeX — Word
  não tem equivalente embutido de KaTeX.
- Sumário sem número de página nem hyperlink — a AST não carrega número de
  página (só o Paged.js resolve isso via `target-counter()`, inexistente fora
  de CSS); listar os títulos sem link é uma degradação honesta, não um bug.
- Figura só embute quando `figure.src` é `data:image/{png,jpeg,gif,bmp}`;
  SVG (usado no fixture `completo`) vira um placeholder de texto — rasterizar
  SVG pediria uma dependência nova (renderer headless de SVG) fora de escopo.
  Dimensão intrínseca da imagem só é lida para PNG (cabeçalho IHDR, sem
  dependência); os demais formatos usam um tamanho padrão.
- Nota de rodapé e nota de fim (`kind: 'footnote' | 'endnote'`) viram a MESMA
  nota de rodapé nativa do Word — implementar as duas partes OOXML
  separadas dobraria a superfície sem um pedido concreto ainda.
- Alinhamento explícito de célula de tabela (`PublicationTableCell.alignment`)
  não é aplicado — usa o alinhamento do token de estilo do parágrafo.

Verificado com as duas fixtures reais do repo (`artigo.md`, `completo.md`,
esta última com citação, nota de rodapé, figura, tabela, matemática, bloco de
código, citação longa e lista) — descompactando o `.docx` gerado e conferindo
XML bem formado e o texto extraído linha a linha antes de escrever qualquer
teste automatizado.

### Licença: `docx` traz `jszip`, dual-licenciado de propósito

`docx` (MIT) depende de `jszip`, cuja licença declarada é
`(MIT OR GPL-3.0-or-later)` — o gate de licenças (`scripts/check-licenses.mjs`,
ADR 0002) trata qualquer substring `GPL-3.0` como proibida em runtime por
padrão, e corretamente bloqueou a instalação até revisão manual. É dual-license
deliberado do autor do jszip (escolha oferecida ao consumidor, não um projeto
que virou copyleft) — mettzer.com e outras ferramentas OOXML fechadas fazem a
mesma escolha. Decisão confirmada explicitamente com o usuário antes de
prosseguir (não foi uma exceção adicionada por reflexo, que é exatamente o
cenário que o comentário do próprio script avisa para não fazer). Registrado
em `EXCECOES` com a justificativa e a versão exata (`jszip@3.10.1`).

### Export Service: processo isolado, mas ao contrário do LSP, in-process não bastaria

Diferente do LSP (P13), que compõe tudo num processo porque não tem motivo de
isolamento, o caminho de PDF sobe um Chromium real via Puppeteer — o MESMO
motivo que justifica o Compiler Service (ADR 0014). Um `apps/desktop/src/export-service/`
novo, estruturalmente idêntico ao `compiler-service/`: recebe a Publication
AST e o formato por MessagePort, devolve bytes, não conhece vault nem
Electron. PDF chama `renderer-html` + `renderer-pdf` (Chromium isolado aqui,
não no Workspace Service); DOCX chama `renderer-docx` (leve, mas fica no
mesmo processo por simplicidade — não há motivo para dois processos de
exportação).

Fronteira nova, `export-service-desktop-nao-conhece-o-vault`: proíbe
`workspace-core`/`workspace-local`/`workspace-index`/`workspace-sessions` e
`electron`/`better-sqlite3`/`react` — mesma forma da regra homônima do
compiler-service.

`ExportSupervisor` (Main) espelha `CompilerSupervisor`/`WorkspaceSupervisor`:
um cliente memoizado, reiniciado sob demanda no próximo pedido depois de um
crash — não um pool crescente por chamada.

Main ↔ Export Service usa o `process.parentPort` nativo do utility process,
adaptado à superfície `MessagePortLike`. A primeira implementação transferia
uma `MessagePortMain` adicional; no Electron real o processo iniciava, mas a
requisição não chegava de forma confiável e a UI aguardava para sempre. É a
mesma classe de falha corrigida no Compiler Service: muda o transporte físico,
não os envelopes nem a execução isolada.

O bundle CommonJS mantém `puppeteer-core` externo e o renderer localiza o
bundle do `pagedjs` dinamicamente. Por isso ambos são dependências runtime
diretas do app desktop, além de dependências de `@abnt/renderer-pdf`: depois de
embutir o código do renderer no Export Service, a resolução de módulos parte de
`dist/export-service`, não do diretório original do package. Sem essa declaração
o utility process encerrava com `Cannot find module 'puppeteer-core'` no
primeiro export.

### O protocolo separa "qual é a AST" de "o que fazer com ela"

`DesktopWorkspaceService.exportDocument({fileId})` devolve a Publication AST
crua da sessão (`session.preview.publication`) — mesma fonte que
`previewEditor` já usa para HTML, sem decidir formato. O NOVO `ExportService`
(`export/run`, protocolo próprio como o do compiler) recebe
`{publication, format}` e devolve `{bytes, pages?}` — não sabe de onde a AST
veio, não conhece fileId nem vault. Quem liga os dois é o canal IPC
`editor.export` (`DesktopExportRequest {fileId, format}`), que só Main
orquestra: pede a AST ao Workspace Service, mostra o diálogo nativo de salvar
(`dialog.showSaveDialog`), manda a AST pro Export Service, escreve os bytes
retornados no caminho escolhido. Nenhuma dessas três peças conhece as outras
duas por inteiro — é a mesma disciplina de fronteira do resto do projeto,
aplicada a um fluxo que atravessa três processos em vez de dois.

`EditorExportResultDto`/`DesktopExportRequest` (caminho final escolhido,
formato) vivem em `@abnt/protocol` ao lado de `DesktopWorkspaceService` — não
fazem parte do contrato do Workspace Service (que nunca abre diálogo nem
escreve fora do vault), mas são o mesmo tipo de DTO desktop-específico que
`DesktopEventDto` já é nesse arquivo.

### Bytes binários atravessando MessagePort: `Uint8Array`, não base64

`ExportResultDto.bytes: Uint8Array`, validado com `z.instanceof(Uint8Array)`.
Structured clone (usado por `MessageChannelMain`/`node:worker_threads`)
transporta `Uint8Array` nativamente — nenhuma codificação base64 no meio,
nenhum custo de serialização de string gigante para um PDF de várias páginas.

## Consequências

- `apps/cli build --formato docx` funciona lado a lado com `pdf`/`html`,
  reaproveitando o mesmo `embutirRecursos` que o caminho de PDF já usava
  (PDF e DOCX são gerados sem documento de origem, então recurso relativo
  precisa vir embutido; HTML continua servido ao lado do arquivo).
- Desktop ganha dois comandos (`document.exportPdf`/`document.exportDocx`) e
  dois botões ao lado do Preview, habilitados com qualquer aba ativa (editor
  ou preview, já que as duas guardam `fileId`).
- `tests/p14-export.test.ts`: três testes de integração sobre `MessageChannel`
  real — `exportDocument` expõe a Publication AST correta (incluindo
  `NOT_FOUND` para arquivo inexistente); Export Service gera DOCX real
  (assinatura ZIP `PK`); Export Service gera PDF real via Chromium de verdade
  (assinatura `%PDF-`, contagem de páginas).
- Verificado manualmente no browser com bridge mockada: botões habilitam só
  com aba ativa, clique chama `editor.export` com `fileId`/`format`
  corretos, mensagem de sucesso mostra o caminho devolvido.
- Smoke no Electron real abre o vault, espera a compilação e gera um PDF pelo
  utility process (`export: true`), cobrindo transporte e dependências runtime
  que o teste in-process deliberadamente não consegue representar.
- `pnpm check` permanece verde; duas fronteiras novas
  (`export-service-desktop-nao-conhece-o-vault` e a cobertura automática de
  `renderer-so-ve-publication` sobre `renderer-docx`/`renderer-pdf`)
  verificadas com violação deliberada antes de confirmar o estado limpo.

## Não decidido aqui

Progresso de exportação (útil para PDFs longos — o usuário não tem feedback
enquanto o Chromium pagina) fica para quando houver um caso real de documento
grande o suficiente para doer. Cancelamento de uma exportação em andamento
(o protocolo já suporta `signal`/`cancel` end-to-end, mas a UI não expõe
botão de cancelar). Rasterização de SVG para DOCX, notas de fim como parte
OOXML separada, alinhamento explícito de célula — mesmas lacunas já detalhadas
acima, deliberadamente adiadas.
