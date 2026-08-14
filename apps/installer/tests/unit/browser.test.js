import { describe, expect, it, vi } from 'vitest';

import { openBrowser, resolveDefaultBrowserLaunch } from '../../src/local/browser.js';

describe('resolveDefaultBrowserLaunch', () => {
  it('usa las asociaciones predeterminadas de Windows desde WSL', () => {
    expect(resolveDefaultBrowserLaunch('https://localhost:8443/login/canvas', {
      platform: 'linux', environment: { WSL_DISTRO_NAME: 'Ubuntu-26.04' }
    })).toEqual({
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', 'start', '', 'https://localhost:8443/login/canvas']
    });
  });

  it('delega al navegador predeterminado de Linux fuera de WSL', () => {
    expect(resolveDefaultBrowserLaunch('https://localhost:8443/login/canvas', {
      platform: 'linux', environment: {}
    })).toEqual({
      command: 'xdg-open', args: ['https://localhost:8443/login/canvas']
    });
  });
});

describe('openBrowser', () => {
  it('no fuerza Chrome y delega en el lanzador del sistema', async () => {
    const launcher = vi.fn().mockResolvedValue(true);

    await expect(openBrowser('https://localhost:8443/login/canvas', {
      platform: 'win32', environment: {}, launcher
    })).resolves.toBe(true);

    expect(launcher).toHaveBeenCalledWith(
      'cmd.exe',
      ['/d', '/s', '/c', 'start', '', 'https://localhost:8443/login/canvas'],
      undefined
    );
  });
});
