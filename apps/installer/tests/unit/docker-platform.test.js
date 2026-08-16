import { describe, expect, it, vi } from 'vitest';

import { DockerCheck } from '../../src/orchestration/boot/checks/docker.js';
import { DockerInstaller } from '../../src/installation/installers/DockerInstaller.js';
import { createDockerPolicy } from '../../src/platform/shared/DockerPolicyFactory.js';
import {
  classifyDockerCliOrigin,
  DockerRuntimeProbe,
  DockerRuntimeStatus
} from '../../src/platform/shared/DockerRuntimeProbe.js';
import { PlatformProbe } from '../../src/platform/shared/PlatformProbe.js';
import { PreflightChecks } from '../../src/installation/PreflightChecks.js';

const linuxHost = {
  name: 'linux',
  release: '6.8',
  isWindows: false,
  isMac: false,
  isLinux: true,
  isWsl: false,
  distro: null
};

const wslHost = {
  ...linuxHost,
  isWsl: true,
  distro: 'Ubuntu'
};

const windowsHost = {
  name: 'win32',
  release: '11',
  isWindows: true,
  isMac: false,
  isLinux: false,
  isWsl: false,
  distro: null
};

function createBootLog() {
  const events = [];
  const log = new Proxy({}, {
    get: (_, level) => (...args) => events.push({ level: String(level), args })
  });
  return { log, events };
}

describe('PlatformProbe', () => {
  it('distinguishes WSL from a native Linux', () => {
    const wsl = new PlatformProbe({
      platform: () => 'linux',
      release: () => '6.6-microsoft',
      env: { WSL_DISTRO_NAME: 'Ubuntu' },
      readProcVersion: () => 'Linux version microsoft-standard-WSL2'
    }).inspect();
    const native = new PlatformProbe({
      platform: () => 'linux',
      release: () => '6.8-generic',
      env: {},
      readProcVersion: () => 'Linux version generic'
    }).inspect();

    expect(wsl).toMatchObject({ isLinux: true, isWsl: true, distro: 'Ubuntu' });
    expect(native).toMatchObject({ isLinux: true, isWsl: false, distro: null });
  });
});

describe('Docker policies by platform', () => {
  it('native Linux recommends Engine and never Docker Desktop', () => {
    const guidance = createDockerPolicy(linuxHost).missing();
    expect(`${guidance.message} ${guidance.action} ${guidance.fix}`).toContain('Docker Engine');
    expect(`${guidance.message} ${guidance.action}`).not.toContain('Docker Desktop');
  });

  it('Windows keeps Docker Desktop as a native solution', () => {
    expect(createDockerPolicy(windowsHost).missing().action).toContain('Docker Desktop');
  });

  it('WSL detects the inherited Windows client and avoids installing a second Engine', () => {
    const guidance = createDockerPolicy(wslHost).daemon({ cliOrigin: 'windows-interop' });
    expect(guidance.action).toContain('enable integration');
    expect(guidance.action).toContain('do not install a second Engine automatically');
  });
});

describe('DockerRuntimeProbe', () => {
  it('classifies a mounted Windows path as WSL interop', () => {
    expect(classifyDockerCliOrigin({
      host: wslHost,
      cliPath: '/mnt/c/Program Files/Docker/Docker/resources/bin/docker',
      clientPlatform: 'windows/amd64',
      dockerHost: ''
    })).toBe('windows-interop');
  });

  it('reports downed daemon without confusing the Windows client with Linux Engine', async () => {
    const runner = vi.fn(async (command, args) => {
      const key = `${command} ${args.join(' ')}`;
      if (key === 'docker --version') return { success: true, out: 'Docker version 29', err: '' };
      if (key === 'which docker') return { success: true, out: '/mnt/c/Program Files/Docker/docker', err: '' };
      if (key === 'docker context show') return { success: true, out: 'desktop-linux', err: '' };
      if (key.startsWith('docker version')) return { success: false, out: 'windows/amd64', err: 'daemon unavailable' };
      if (key.startsWith('docker info')) return { success: false, out: '', err: 'daemon unavailable' };
      if (key === 'docker compose version') return { success: true, out: 'v2', err: '' };
      throw new Error(`Unexpected command: ${key}`);
    });
    const probe = new DockerRuntimeProbe({
      runner,
      platformProbe: { inspect: () => wslHost },
      env: {}
    });

    await expect(probe.inspect()).resolves.toMatchObject({
      status: DockerRuntimeStatus.DAEMON_DOWN,
      backend: 'docker-desktop-wsl',
      cliOrigin: 'windows-interop',
      composeAvailable: true
    });
  });
});

describe('DockerCheck and preflight', () => {
  it('shows Linux instructions when Docker is missing', async () => {
    const state = {
      status: DockerRuntimeStatus.MISSING,
      host: linuxHost,
      cliAvailable: false,
      cliOrigin: 'none'
    };
    const { log, events } = createBootLog();
    const result = await new DockerCheck(7.5, {
      probe: { inspect: vi.fn().mockResolvedValue(state) }
    }).run(log);
    const output = events.flatMap(event => event.args).join(' ');

    expect(result.ok).toBe(false);
    expect(result.fix).toContain('/engine/install/');
    expect(output).not.toContain('Install Docker Desktop');
  });

  it('keeps the permission cause so that setup does not wait uselessly', async () => {
    const state = {
      status: DockerRuntimeStatus.PERMISSION_DENIED,
      host: linuxHost,
      cliAvailable: true,
      cliOrigin: 'native',
      composeAvailable: true
    };
    const preflight = new PreflightChecks(createBootLog().log, '/canvas', '/plugin', {
      dockerProbe: { inspect: vi.fn().mockResolvedValue(state) }
    });

    await expect(preflight.checkDocker()).resolves.toMatchObject({
      ok: false,
      details: { docker_permission_denied: true, docker_state: state }
    });
  });

  it('treats an unavailable Windows client as missing Docker for native installation', async () => {
    const state = {
      status: DockerRuntimeStatus.DAEMON_DOWN,
      host: wslHost,
      cliAvailable: true,
      cliOrigin: 'windows-interop',
      composeAvailable: true,
      daemonAvailable: false
    };
    const preflight = new PreflightChecks(createBootLog().log, '/canvas', '/plugin', {
      dockerProbe: { inspect: vi.fn().mockResolvedValue(state) }
    });

    await expect(preflight.checkDocker()).resolves.toMatchObject({
      ok: false,
      details: {
        missing_docker: true,
        windows_docker_interop_unavailable: true,
        docker_state: state
      }
    });
  });

  it('does not treat the inherited Windows client as a native Engine installation', async () => {
    const strategy = { isInstalled: vi.fn().mockResolvedValue(false) };
    const installer = new DockerInstaller(createBootLog().log, null, {
      platformProbe: { inspect: () => wslHost },
      probe: {
        inspect: vi.fn().mockResolvedValue({
          cliAvailable: true,
          cliOrigin: 'windows-interop'
        })
      },
      strategy
    });

    await expect(installer.isDockerInstalled()).resolves.toBe(false);
    expect(strategy.isInstalled).toHaveBeenCalledOnce();
  });
});
