import { describe, it, expect } from 'vitest';
import { ContainerExecutionPolicy, ExecutionContext } from '../../src/platform/shared/ContainerExecutionPolicy.js';

describe('ContainerExecutionPolicy', () => {
  describe('Sin profile (comportamiento neutral)', () => {
    it('debe devolver null para build USER_ID', () => {
      const policy = new ContainerExecutionPolicy(null);
      expect(policy.getBuildUserId()).toBeNull();
    });

    it('debe devolver argumentos vacios para cualquier contexto', () => {
      const policy = new ContainerExecutionPolicy({});
      expect(policy.getExecutionArgs(ExecutionContext.WORKSPACE_WRITE)).toEqual([]);
    });
  });

  describe('Linux Rootful', () => {
    const rootfulProfile = {
      backend: 'docker-engine-linux',
      capabilities: {
        rootless: false,
        usernsRemap: false,
        hostUid: 1000,
        installerIsRoot: false
      }
    };

    it('debe inyectar USER_ID en build', () => {
      const policy = new ContainerExecutionPolicy(rootfulProfile);
      expect(policy.getBuildUserId()).toBe('1000');
    });

    it('NO debe usar 0:0 para ejecucion normal', () => {
      const policy = new ContainerExecutionPolicy(rootfulProfile);
      expect(policy.getExecutionArgs(ExecutionContext.NATIVE)).toEqual([]);
    });

    it('NO debe usar 0:0 para workspace-write', () => {
      const policy = new ContainerExecutionPolicy(rootfulProfile);
      expect(policy.getExecutionArgs(ExecutionContext.WORKSPACE_WRITE)).toEqual([]);
    });
  });

  describe('Linux Rootless', () => {
    const rootlessProfile = {
      backend: 'docker-engine-linux',
      capabilities: {
        rootless: true,
        usernsRemap: false,
        hostUid: 1000,
        installerIsRoot: false
      }
    };

    it('NO debe propagar USER_ID en build', () => {
      const policy = new ContainerExecutionPolicy(rootlessProfile);
      expect(policy.getBuildUserId()).toBeNull();
    });

    it('debe mantener usuario nativo para contexto normal', () => {
      const policy = new ContainerExecutionPolicy(rootlessProfile);
      expect(policy.getExecutionArgs(ExecutionContext.NATIVE)).toEqual([]);
    });

    it('debe usar --user 0:0 exclusivamente para contexto workspace-write', () => {
      const policy = new ContainerExecutionPolicy(rootlessProfile);
      expect(policy.getExecutionArgs(ExecutionContext.WORKSPACE_WRITE)).toEqual(['--user', '0:0']);
    });
  });

  describe('usernsRemap', () => {
    const remapProfile = {
      backend: 'docker-engine-linux',
      capabilities: {
        rootless: false,
        usernsRemap: true,
        hostUid: 1000,
        installerIsRoot: false
      }
    };

    it('NO debe propagar USER_ID en build', () => {
      const policy = new ContainerExecutionPolicy(remapProfile);
      expect(policy.getBuildUserId()).toBeNull();
    });

    it('NO debe heredar automaticamente la estrategia Rootless de 0:0', () => {
      const policy = new ContainerExecutionPolicy(remapProfile);
      expect(policy.getExecutionArgs(ExecutionContext.WORKSPACE_WRITE)).toEqual([]);
    });
  });
});
