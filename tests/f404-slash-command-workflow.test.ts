import { describe, expect, it } from 'vitest';

describe('F404 — slash command workflow', () => {
  it('usa completion nativa e comandos do registry', async () => {
    const source = await import('node:fs/promises').then((fs) => fs.readFile('apps/desktop/src/renderer/app.tsx', 'utf8'));
    expect(source).toContain('const SLASH_COMMAND_IDS = new Set');
    expect(source).toContain('rankCommands(registry, {}, query)');
    expect(source).toContain('slashCommands={{ list: (query) => slashCommandList(commandRegistry, query), execute: handleCommand }}');
    expect(source).not.toContain('SlashCommandPopup');
  });
});
