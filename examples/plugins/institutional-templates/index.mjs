const plugin = { id: 'folio.institutional-templates', version: '1.0.0' };
process.send?.({ version: 1, type: 'abnt-plugin/ready', plugin });
process.on('message', (message) => {
  if (message?.type !== 'abnt-plugin/command') return;
  const templateKind = { 'create-institutional-tcc': 'institutional-tcc', 'create-institutional-article': 'institutional-article' }[message.commandId];
  const result = templateKind === undefined ? { kind: 'notice', message: 'Comando de template não reconhecido.' } : { kind: 'open-template', templateKind, message: 'Escolha o caminho para o novo documento institucional.' };
  process.send?.({ version: 1, type: 'abnt-plugin/command-result', requestId: message.requestId, ok: true, result });
});
