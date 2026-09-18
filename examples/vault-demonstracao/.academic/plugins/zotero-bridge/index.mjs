const plugin = { id: 'folio.zotero-bridge', version: '1.0.0' };
process.send?.({ version: 1, type: 'abnt-plugin/ready', plugin });
process.on('message', (message) => {
  if (message?.type !== 'abnt-plugin/command') return;
  const result = message.commandId === 'import-csl-json'
    ? { kind: 'open-intake', intakeFormat: 'csl-json', message: 'Inbox aberta para a exportação CSL-JSON do Zotero.' }
    : { kind: 'notice', message: 'Comando Zotero não reconhecido.' };
  process.send?.({ version: 1, type: 'abnt-plugin/command-result', requestId: message.requestId, ok: true, result });
});
