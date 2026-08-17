import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EnvironmentSetup } from '../../src/installation/EnvironmentSetup.js';
import { PreflightChecks } from '../../src/installation/PreflightChecks.js';

vi.mock('../../src/installation/PreflightChecks.js');

describe('Fast Boot Probing Model', () => {
  let envSetup;
  let mockDockerInstaller;
  let mockBoot;

  beforeEach(() => {
    mockBoot = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      success: vi.fn(),
      action: vi.fn()
    };

    mockDockerInstaller = {
      getRuntimeState: vi.fn().mockResolvedValue({ daemonAvailable: true }),
      handleDockerDaemonDown: vi.fn()
    };

    envSetup = new EnvironmentSetup(mockBoot, '/plugin', '/canvas', {
      dockerInstallerFactory: () => mockDockerInstaller
    });

    envSetup._ensureLogsDirectory = vi.fn();
    envSetup._bringupAndVerify = vi.fn().mockResolvedValue(true);
    envSetup._verifyPostInstall = vi.fn().mockResolvedValue(true);
    envSetup._provisionMissing = vi.fn().mockResolvedValue({});
  });

  it('Entorno sano → camino rápido sin reparaciones', async () => {
    PreflightChecks.mockImplementation(() => ({
      runChecks: vi.fn().mockResolvedValue({ allOk: true, missing: {} })
    }));

    await envSetup._runFastBoot({ daemonAvailable: true });

    expect(envSetup._provisionMissing).not.toHaveBeenCalled();
    expect(envSetup._bringupAndVerify).toHaveBeenCalled();
  });

  it('Entorno sano + Docker detenido → recuperación sin reinstalación', async () => {
    const brokenProfile = { daemonAvailable: false };
    mockDockerInstaller.handleDockerDaemonDown.mockResolvedValue(true);
    mockDockerInstaller.getRuntimeState.mockResolvedValue({ daemonAvailable: true });

    PreflightChecks.mockImplementation(() => ({
      runChecks: vi.fn().mockResolvedValue({ allOk: true, missing: {} })
    }));

    await envSetup._runFastBoot(brokenProfile);

    expect(mockDockerInstaller.handleDockerDaemonDown).toHaveBeenCalledWith(brokenProfile);
    expect(envSetup._provisionMissing).not.toHaveBeenCalled();
    expect(envSetup._bringupAndVerify).toHaveBeenCalled();
  });

  it('Entorno sano + Canvas detenido → start/up (vía CanvasBringup), no rebuild (reparación acotada)', async () => {
    PreflightChecks.mockImplementation(() => ({
      runChecks: vi.fn().mockResolvedValue({
        allOk: false,
        missing: { missing_canvas_assets: false, missing_canvas_clone: false } // No faltan assets ni clone, solo algo estático no ok
      })
    }));

    await envSetup._runFastBoot({ daemonAvailable: true });

    // En este caso entra a _provisionMissing con missing_canvas_assets = false, así que AssetBuilder no corre build.
    expect(envSetup._provisionMissing).toHaveBeenCalledWith(
      expect.objectContaining({ missing_canvas_assets: false }),
      expect.anything()
    );
    expect(envSetup._bringupAndVerify).toHaveBeenCalled();
  });

  it('Entorno sano + Gotenberg detenido → recuperación acotada de Gotenberg', async () => {
    PreflightChecks.mockImplementation(() => ({
      runChecks: vi.fn().mockResolvedValue({
        allOk: false,
        missing: { missing_gotenberg: true, missing_plugin_db: false }
      })
    }));

    await envSetup._runFastBoot({ daemonAvailable: true });

    expect(envSetup._provisionMissing).toHaveBeenCalledWith(
      expect.objectContaining({ missing_gotenberg: true }),
      expect.anything()
    );
  });
});
