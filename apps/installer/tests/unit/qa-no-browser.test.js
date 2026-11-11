import { describe, expect, it, vi } from 'vitest';
import { openBrowser, shouldAutoOpenBrowser } from '../../src/local/browser.js';
import { Orchestrator } from '../../src/local/Orchestrator.js';

const testEnvironment = { PLUGIN_TEST_MODE: 'true', PLUGIN_QA_NO_BROWSER: 'true' };
const normalEnvironment = { WSL_DISTRO_NAME: 'Ubuntu-26.04' };

function fakeBoot() {
  return {
    plain: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    action: vi.fn()
  };
}

describe('QA headless: no cambiar el flujo normal', () => {
  it('mantiene apertura normal por defecto y con solo una bandera', () => {
    expect(shouldAutoOpenBrowser(normalEnvironment)).toBe(true);
    expect(shouldAutoOpenBrowser({ PLUGIN_TEST_MODE: 'true' })).toBe(true);
    expect(shouldAutoOpenBrowser({ PLUGIN_QA_NO_BROWSER: 'true' })).toBe(true);
    expect(shouldAutoOpenBrowser(testEnvironment)).toBe(false);
  });

  it('no ejecuta ningún lanzador en QA aunque se solicite abrir una URL', async () => {
    const launcher = vi.fn();
    expect(await openBrowser('https://localhost:8443/login/canvas', {
      environment: testEnvironment, launcher
    })).toBe(false);
    expect(launcher).not.toHaveBeenCalled();
  });

  it('suprime la ventana después de confirmar disponibilidad de Canvas', async () => {
    const boot = fakeBoot();
    const wait = vi.fn().mockResolvedValue(undefined);
    const open = vi.fn().mockResolvedValue(true);
    const orchestrator = new Orchestrator(boot, '/qa/plugin', '/qa/canvas', {
      environment: testEnvironment, waitForCanvasReadyFn: wait, openBrowserFn: open
    });
    await orchestrator.waitForCanvasAndOpenBrowser();
    expect(wait).toHaveBeenCalledOnce();
    expect(open).not.toHaveBeenCalled();
    expect(boot.info.mock.calls.flat().join(' ')).toContain('QA-NO-BROWSER-001');
    expect(boot.action).not.toHaveBeenCalled();
  });

  it('mantiene el navegador del usuario al ejecutarse normalmente', async () => {
    const boot = fakeBoot();
    const wait = vi.fn().mockResolvedValue(undefined);
    const open = vi.fn().mockResolvedValue(true);
    const orchestrator = new Orchestrator(boot, '/plugin', '/canvas', {
      environment: normalEnvironment, waitForCanvasReadyFn: wait, openBrowserFn: open
    });
    await orchestrator.waitForCanvasAndOpenBrowser();
    expect(wait).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledWith('https://localhost:8443/login/canvas');
    expect(boot.warn).not.toHaveBeenCalled();
  });
});
