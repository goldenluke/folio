import { describe, expect, it } from 'vitest';
import { matchSlashTrigger } from '@abnt/editor-codemirror';

describe('F326–F330 — trigger de slash commands no CodeMirror', () => {
  it('casa "/" como primeiro caractere não-espaço da linha', () => {
    expect(matchSlashTrigger('/')).toEqual({ triggerOffset: 0, query: '' });
    expect(matchSlashTrigger('/fig')).toEqual({ triggerOffset: 0, query: 'fig' });
  });
  it('preserva o espaço em branco líder no offset do trigger', () => {
    expect(matchSlashTrigger('  /tab')).toEqual({ triggerOffset: 2, query: 'tab' });
  });
  it('não casa "/" no meio da linha nem com espaço após o trigger', () => {
    expect(matchSlashTrigger('chapters/metodo.md')).toBeUndefined();
    expect(matchSlashTrigger('/fig ure')).toBeUndefined();
    expect(matchSlashTrigger('texto antes /fig')).toBeUndefined();
  });
  it('não casa string vazia nem texto sem "/"', () => {
    expect(matchSlashTrigger('')).toBeUndefined();
    expect(matchSlashTrigger('texto qualquer')).toBeUndefined();
  });
});
