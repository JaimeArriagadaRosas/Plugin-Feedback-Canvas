import { describe, expect, it } from 'vitest';
import { CanvasLocalConfiguration } from '../../src/installation/installers/CanvasLocalConfiguration.js';

describe('CanvasLocalConfiguration', () => {
  const boot = { info: () => {}, success: () => {}, warn: () => {} };

  it('no inyecta USER_ID si el backend no es docker-engine-linux', () => {
    const config = new CanvasLocalConfiguration(boot, '/canvas', {
      dockerProfile: { backend: 'docker-desktop-windows', capabilities: { hostUid: 1000 } }
    });
    const service = config._applyUserIdArgs({});
    expect(service.build?.args?.USER_ID).toBeUndefined();
  });

  it('no inyecta USER_ID si el instalador corre como root', () => {
    const config = new CanvasLocalConfiguration(boot, '/canvas', {
      dockerProfile: { backend: 'docker-engine-linux', capabilities: { hostUid: 0, installerIsRoot: true } }
    });
    const service = config._applyUserIdArgs({});
    expect(service.build?.args?.USER_ID).toBeUndefined();
  });

  it('no inyecta USER_ID si es rootless o usernsRemap', () => {
    const config = new CanvasLocalConfiguration(boot, '/canvas', {
      dockerProfile: { backend: 'docker-engine-linux', capabilities: { hostUid: 1000, rootless: true } }
    });
    const service = config._applyUserIdArgs({});
    expect(service.build?.args?.USER_ID).toBeUndefined();
  });

  it('inyecta USER_ID en docker-engine-linux nativo con usuario normal', () => {
    const config = new CanvasLocalConfiguration(boot, '/canvas', {
      dockerProfile: { backend: 'docker-engine-linux', capabilities: { hostUid: 1000 } }
    });
    const service = config._applyUserIdArgs({});
    expect(service.build.args.USER_ID).toBe('1000');
  });
});
