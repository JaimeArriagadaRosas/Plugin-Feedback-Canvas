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

  it('Healthy environment -> fast path without repairs', async () => {
    PreflightChecks.mockImplementation(() => ({
      runChecks: vi.fn().mockResolvedValue({ allOk: true, missing: {} })
    }));

    await envSetup._runFastBoot({ daemonAvailable: true });

    expect(envSetup._provisionMissing).not.toHaveBeenCalled();
    expect(envSetup._bringupAndVerify).toHaveBeenCalled();
  });

  it('Healthy environment + Docker stopped -> recovery without reinstall', async () => {
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

  it('Healthy environment + Canvas stopped -> start/up (via CanvasBringup), no rebuild (bounded repair)', async () => {
    PreflightChecks.mockImplementation(() => ({
      runChecks: vi.fn().mockResolvedValue({
        allOk: false,
        missing: { missing_canvas_assets: false, missing_canvas_clone: false } // No missing assets or clone, just static something not ok
      })
    }));

    await envSetup._runFastBoot({ daemonAvailable: true });

    // In this case enters _provisionMissing with missing_canvas_assets = false, so AssetBuilder does not run build.
    expect(envSetup._provisionMissing).toHaveBeenCalledWith(
      expect.objectContaining({ missing_canvas_assets: false }),
      expect.anything()
    );
    expect(envSetup._bringupAndVerify).toHaveBeenCalled();
  });

  it('Healthy environment + Gotenberg stopped/unhealthy -> bounded Gotenberg recovery', async () => {
    PreflightChecks.mockImplementation(() => ({
      runChecks: vi.fn().mockResolvedValue({
        allOk: false,
        missing: { gotenberg_status: 'exited', plugin_db_status: 'healthy' }
      })
    }));

    await envSetup._runFastBoot({ daemonAvailable: true });

    expect(envSetup._provisionMissing).toHaveBeenCalledWith(
      expect.objectContaining({ gotenberg_status: 'exited' }),
      expect.anything()
    );
  });
});
