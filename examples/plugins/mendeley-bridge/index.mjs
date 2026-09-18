const plugin = { id: 'folio.mendeley-bridge', version: '1.0.0' };
process.send?.({ version: 1, type: 'abnt-plugin/ready', plugin });
process.on('message', (message) => {
  if (message?.type !== 'abnt-plugin/command') return;
  const formats = { 'import-ris': 'ris', 'import-bibtex': 'bibtex' };
  const intakeFormat = formats[message.commandId];
  const result = intakeFormat === undefined ? { kind: 'notice', message: 'Comando Mendeley não reconhecido.' } : { kind: 'open-intake', intakeFormat, message: `Inbox aberta para a exportação ${intakeFormat.toUpperCase()} do Mendeley.` };
  process.send?.({ version: 1, type: 'abnt-plugin/command-result', requestId: message.requestId, ok: true, result });
});
