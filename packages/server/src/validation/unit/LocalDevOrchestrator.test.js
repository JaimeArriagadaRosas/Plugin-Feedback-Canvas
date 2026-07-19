import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocalDevOrchestrator } from '../../setup/local-dev/LocalDevOrchestrator.js';
import { BootResult } from '../../orchestration/boot/result.js';

// Mocks
vi.mock('../../orchestration/boot/setup/EnvironmentSetup.js', () => ({
  EnvironmentSetup: vi.fn().mockImplementation(() => ({
    ensureSetup: vi.fn().mockResolvedValue(true)
  }))
}));
vi.mock('../../orchestration/boot/lti.js', () => ({
  LtiBootstrap: vi.fn().mockImplementation(() => ({
    run: vi.fn().mockResolvedValue(BootResult.ok({}))
  }))
}));
vi.mock('../../orchestration/browser.js', () => ({
  waitForCanvasReady: vi.fn().mockResolvedValue(true),
  openBrowser: vi.fn().mockResolvedValue(true)
}));

describe('LocalDevOrchestrator (Local)', () => {
  let mockBoot;
  let orchestrator;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBoot = {
      withStage: vi.fn(async (name, fn) => fn()),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      success: vi.fn(),
      action: vi.fn(),
      debug: vi.fn(),
    };
    orchestrator = new LocalDevOrchestrator(mockBoot, '/plugin/dir', '/canvas/dir');
  });

  it('debe completar setupLocalCanvas exitosamente', async () => {
    await expect(orchestrator.setupLocalCanvas('3')).resolves.toBeUndefined();
    expect(mockBoot.withStage).toHaveBeenCalledWith('Verificación e instalación de Canvas LMS', expect.any(Function));
    expect(mockBoot.withStage).toHaveBeenCalledWith('Inicialización LTI 1.3', expect.any(Function));
  });

  it('debe esperar a Canvas y abrir el navegador', async () => {
    await orchestrator.waitForCanvasAndOpenBrowser();
    expect(mockBoot.withStage).toHaveBeenCalledWith('Canvas LMS (espera de listo)', expect.any(Function));
    expect(mockBoot.info).toHaveBeenCalledWith(expect.stringContaining('Abriendo https://localhost:8443/login/canvas'));
  });
});
