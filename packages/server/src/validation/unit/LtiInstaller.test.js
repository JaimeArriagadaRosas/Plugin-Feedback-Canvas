import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LtiVerifier } from '../../setup/LtiVerifier.js';
import { DockerLtiConfigurator } from '../../setup/local-dev/DockerLtiConfigurator.js';
import { TeacherTokenGenerator } from '../../setup/local-dev/TeacherTokenGenerator.js';
import { LtiInstaller } from '../../setup/local-dev/LtiInstaller.js';

// Mock dependencies
vi.mock('../../setup/LtiVerifier.js', () => ({
  LtiVerifier: {
    isCanvasRunning: vi.fn(),
    checkLtiStatus: vi.fn()
  }
}));

vi.mock('../../setup/local-dev/DockerLtiConfigurator.js', () => ({
  DockerLtiConfigurator: {
    cleanDatabase: vi.fn(),
    injectLtiTool: vi.fn()
  }
}));

vi.mock('../../setup/local-dev/TeacherTokenGenerator.js', () => ({
  TeacherTokenGenerator: {
    generate: vi.fn()
  }
}));

vi.mock('../../orchestration/envWriter.js', () => ({
  updateEnvVars: vi.fn()
}));

describe('LtiInstaller (Local)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('debe arrojar error si Canvas no está corriendo', async () => {
    LtiVerifier.isCanvasRunning.mockResolvedValue(false);
    await expect(LtiInstaller.verifyAndInstall()).rejects.toThrow(/Canvas LMS no está corriendo/);
  });

  it('no debe instalar si LTI ya está en formato moderno', async () => {
    LtiVerifier.isCanvasRunning.mockResolvedValue(true);
    LtiVerifier.checkLtiStatus.mockResolvedValue('OK');
    
    await LtiInstaller.verifyAndInstall();
    
    expect(DockerLtiConfigurator.cleanDatabase).not.toHaveBeenCalled();
    expect(DockerLtiConfigurator.injectLtiTool).not.toHaveBeenCalled();
    expect(TeacherTokenGenerator.generate).toHaveBeenCalled();
  });

  it('debe instalar y procesar el token si no está instalado', async () => {
    LtiVerifier.isCanvasRunning.mockResolvedValue(true);
    LtiVerifier.checkLtiStatus.mockResolvedValue('FAIL');
    
    DockerLtiConfigurator.cleanDatabase.mockResolvedValue();
    DockerLtiConfigurator.injectLtiTool.mockResolvedValue('12345');
    TeacherTokenGenerator.generate.mockResolvedValue();
    
    await LtiInstaller.verifyAndInstall();
    
    expect(DockerLtiConfigurator.cleanDatabase).toHaveBeenCalled();
    expect(DockerLtiConfigurator.injectLtiTool).toHaveBeenCalled();
    expect(TeacherTokenGenerator.generate).toHaveBeenCalled();
  });
});
