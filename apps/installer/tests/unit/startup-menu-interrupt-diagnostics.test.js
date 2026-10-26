import { describe, it, expect, vi, afterEach } from 'vitest';
const prompt = vi.hoisted(() => ({ input: vi.fn(), confirm: vi.fn() }));
vi.mock('@inquirer/prompts', () => prompt);
import { ask, showMainMenu, MenuCancelledError } from '../../src/orchestration/cli.js';
afterEach(()=>{vi.restoreAllMocks();prompt.input.mockReset();delete process.env.NON_INTERACTIVE;delete process.env.STARTUP_MODE;});
describe('menu cancellation and choice regression',()=>{
  it('Ctrl+C rejects without starting default mode 3', async()=>{
    vi.spyOn(console,'log').mockImplementation(()=>{});
    prompt.input.mockRejectedValueOnce(Object.assign(new Error('Prompt canceled'),{name:'ExitPromptError'}));
    await expect(showMainMenu()).rejects.toBeInstanceOf(MenuCancelledError);
  });
  it('blank Enter selects default 3',async()=>{
    vi.spyOn(console,'log').mockImplementation(()=>{});
    prompt.input.mockResolvedValueOnce(' ');
    await expect(showMainMenu()).resolves.toBe('3');
  });
  it('invalid response loops, then accepts zero exit',async()=>{
    vi.spyOn(console,'log').mockImplementation(()=>{});
    prompt.input.mockResolvedValueOnce('999').mockResolvedValueOnce('0');
    await expect(showMainMenu()).resolves.toBe('0');
    expect(prompt.input).toHaveBeenCalledTimes(2);
  });
  it('selecting zero does not return default mode',async()=>{
    vi.spyOn(console,'log').mockImplementation(()=>{});
    prompt.input.mockResolvedValueOnce('0');
    await expect(showMainMenu()).resolves.toBe('0');
  });
  it('prompt cancellation never silently falls back',async()=>{
    prompt.input.mockRejectedValueOnce(Object.assign(new Error('Prompt canceled'),{name:'ExitPromptError'}));
    await expect(ask('Select an option','3')).rejects.toBeInstanceOf(MenuCancelledError);
  });
});
