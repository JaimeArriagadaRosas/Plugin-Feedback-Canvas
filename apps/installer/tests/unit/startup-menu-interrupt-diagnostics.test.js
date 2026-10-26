import { describe, it, expect, vi, afterEach } from 'vitest';

const prompt = vi.hoisted(() => ({ input: vi.fn(), confirm: vi.fn() }));
vi.mock('@inquirer/prompts', () => prompt);

import { ask, showMainMenu } from '../../src/orchestration/cli.js';

afterEach(() => {
  vi.restoreAllMocks();
  prompt.input.mockReset();
  delete process.env.NON_INTERACTIVE;
  delete process.env.STARTUP_MODE;
});

describe('baseline menu interruption: diagnostic tests (current behavior, NOT accepted design)', () => {
  it('Ctrl+C prompt rejection incorrectly selects default mode 3', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    prompt.input.mockRejectedValueOnce(Object.assign(new Error('Prompt canceled'), { name: 'ExitPromptError' }));
    const mode = await showMainMenu();
    expect(mode).toBe('3');
    expect(prompt.input).toHaveBeenCalledOnce();
    log.mockRestore();
  });

  it('blank Enter intentionally selects default mode 3', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    prompt.input.mockResolvedValueOnce('  ');
    expect(await showMainMenu()).toBe('3');
  });

  it('invalid entry is not validated and passes through to the orchestrator', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    prompt.input.mockResolvedValueOnce('999');
    expect(await showMainMenu()).toBe('999');
  });

  it('explicit zero is returned but is not a supported menu mode', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    prompt.input.mockResolvedValueOnce('0');
    expect(await showMainMenu()).toBe('0');
  });

  it('interrupted confirmations are silently treated as their default', async () => {
    prompt.input.mockRejectedValueOnce(Object.assign(new Error('Prompt canceled'), { name: 'ExitPromptError' }));
    expect(await ask('Select an option', '3')).toBe('3');
  });
});
