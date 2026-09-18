const plugin = { id: 'folio.scholarly-search', version: '1.0.0' };
process.send?.({ version: 1, type: 'abnt-plugin/ready', plugin });
process.on('message', (message) => {
  if (message?.type !== 'abnt-plugin/command') return;
  const result = message.commandId === 'resolve-identifier' ? { kind: 'open-intake', message: 'Inbox aberta: informe DOI, PMID, ISBN, arXiv ou ADS para buscar metadata revisável.' } : { kind: 'notice', message: 'Comando de busca não reconhecido.' };
  process.send?.({ version: 1, type: 'abnt-plugin/command-result', requestId: message.requestId, ok: true, result });
});
