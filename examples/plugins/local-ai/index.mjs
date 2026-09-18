const plugin = { id: 'folio.local-ai', version: '1.0.0' };
process.send?.({ version: 1, type: 'abnt-plugin/ready', plugin });
process.on('message', (message) => {
  if (message?.type !== 'abnt-plugin/command') return;
  const result = message.commandId === 'open-local-assistant' ? { kind: 'open-structured-research', message: 'Assistente local aberto; revise o disclosure antes de enviar qualquer texto.' } : { kind: 'notice', message: 'Comando de IA local não reconhecido.' };
  process.send?.({ version: 1, type: 'abnt-plugin/command-result', requestId: message.requestId, ok: true, result });
});
