import { describe, expect, it, vi } from 'vitest';

import { WindowsDockerMemoryConfigurator } from '../../src/platform/windows/WindowsDockerMemoryConfigurator.js';
import { LinuxAptDockerInstaller } from '../../src/platform/linux/LinuxAptDockerInstaller.js';
import { LinuxDockerInstaller } from '../../src/platform/linux/LinuxDockerInstaller.js';

const linuxHost = { isWsl: false };
const wslHost = { isWsl: true };

function createBootLog() {
  const events = [];
  const log = new Proxy({}, {
    get: (_, level) => (...args) => events.push({ level: String(level), args })
  });
  return { log, events };
}

describe('Adaptadores nativos de Docker', () => {
  it('APT configura el repositorio oficial de Docker sin ejecutar un shell remoto', async () => {
    const calls = [];
    const runner = vi.fn(async (command, args, options = {}) => {
      calls.push({ command, args, options });
      if (command === 'dpkg-query') return { success: false, out: '', err: 'no instalado' };
      if (command === 'dpkg') return { success: true, out: 'amd64\n', err: '' };
      return { success: true, out: '', err: '' };
    });
    const installer = new LinuxAptDockerInstaller({
      runner,
      logFile: null,
      distributionProbe: {
        inspect: () => ({ id: 'ubuntu', repository: 'ubuntu', codename: 'resolute' })
      }
    });

    await expect(installer.install()).resolves.toMatchObject({ success: true });
    const commands = calls.map(({ command, args }) => [command, ...args]);
    expect(commands).toContainEqual(['sudo', 'apt-get', 'install', '-y', 'ca-certificates', 'curl']);
    expect(commands).toContainEqual([
      'sudo', 'apt-get', 'install', '-y', 'docker-ce', 'docker-ce-cli', 'containerd.io',
      'docker-buildx-plugin', 'docker-compose-plugin', 'docker-ce-rootless-extras'
    ]);
    expect(commands).toContainEqual([
      'sudo', 'curl', '-fsSL', 'https://download.docker.com/linux/ubuntu/gpg',
      '-o', '/etc/apt/keyrings/docker.asc'
    ]);
    const repository = calls.find(({ command, args }) => command === 'sudo' && args[0] === 'tee');
    expect(repository.options.input).toContain('Suites: resolute');
    expect(repository.options.input).toContain('Signed-By: /etc/apt/keyrings/docker.asc');
    expect(commands.flat().join(' ')).not.toContain('get-docker.sh');
    expect(commands.some((call) => call[0] === 'sh' || call[0] === 'bash')).toBe(false);
  });

  it('delega APT y configura servicio y acceso por separado', async () => {
    const calls = [];
    const runner = vi.fn(async (command, args) => {
      calls.push([command, ...args]);
      if (command === 'which') {
        return { success: ['apt-get', 'systemctl'].includes(args[0]), out: '', err: '' };
      }
      return { success: true, out: '', err: '' };
    });
    const aptInstaller = { install: vi.fn().mockResolvedValue({ success: true, out: '', err: '' }) };
    const installer = new LinuxDockerInstaller(createBootLog().log, null, {
      host: linuxHost,
      runner,
      username: () => 'test-user',
      confirmRootless: vi.fn().mockResolvedValue(false),
      confirmGroup: vi.fn().mockResolvedValue(true),
      aptInstaller
    });

    await expect(installer.install()).resolves.toBe(true);
    expect(aptInstaller.install).toHaveBeenCalledOnce();
    expect(calls).toContainEqual(['sudo', 'systemctl', 'enable', '--now', 'docker']);
    expect(calls).toContainEqual(['sudo', 'usermod', '-aG', 'docker', 'test-user']);
  });

  it('WSL no confunde el señuelo de Docker Desktop con un Engine Linux instalado', async () => {
    const installer = new LinuxDockerInstaller(createBootLog().log, null, {
      host: wslHost,
      runner: vi.fn().mockResolvedValue({
        success: true,
        out: '/mnt/c/Program Files/Docker/Docker/resources/bin/docker\n',
        err: ''
      })
    });

    await expect(installer.isInstalled()).resolves.toBe(false);
  });

  it('recomienda rootless y no inicia el daemon privilegiado cuando funciona', async () => {
    const calls = [];
    const runner = vi.fn(async (command, args) => {
      calls.push([command, ...args]);
      if (command === 'which') return { success: args[0] === 'apt-get', out: '', err: '' };
      return { success: true, out: '', err: '' };
    });
    const rootlessInstaller = { install: vi.fn().mockResolvedValue({ success: true, out: '', err: '' }) };
    const installer = new LinuxDockerInstaller(createBootLog().log, null, {
      host: linuxHost,
      runner,
      username: () => 'test-user',
      confirmRootless: vi.fn().mockResolvedValue(true),
      confirmGroup: vi.fn(),
      aptInstaller: { install: vi.fn().mockResolvedValue({ success: true, out: '', err: '' }) },
      rootlessInstaller
    });

    await expect(installer.install()).resolves.toBe(true);
    expect(rootlessInstaller.install).toHaveBeenCalledWith('apt', 'test-user');
    expect(calls.some((call) => call.includes('systemctl'))).toBe(false);
    expect(calls.some((call) => call.includes('usermod'))).toBe(false);
  });

  it('conserva una sola clave de memoria en Windows', async () => {
    let written = '';
    const configurator = new WindowsDockerMemoryConfigurator({
      homedir: () => 'C:\\Users\\test',
      exists: () => true,
      readFile: () => '[wsl2]\nmemory=4GB\nprocessors=4\n',
      writeFile: (_file, content) => { written = content; },
      shutdownWsl: vi.fn(),
      delay: vi.fn()
    });

    await configurator.configure(createBootLog().log);
    expect(written.match(/^memory=/gm)).toHaveLength(1);
    expect(written).toContain('memory=8GB');
    expect(written).toContain('processors=4');
  });

  it('no concede el grupo docker sin confirmación separada', async () => {
    const calls = [];
    const runner = vi.fn(async (command, args) => {
      calls.push([command, ...args]);
      if (command === 'which') {
        return { success: ['apt-get', 'systemctl'].includes(args[0]), out: '', err: '' };
      }
      return { success: true, out: '', err: '' };
    });
    const installer = new LinuxDockerInstaller(createBootLog().log, null, {
      host: linuxHost,
      runner,
      username: () => 'test-user',
      confirmRootless: vi.fn().mockResolvedValue(false),
      confirmGroup: vi.fn().mockResolvedValue(false),
      aptInstaller: { install: vi.fn().mockResolvedValue({ success: true, out: '', err: '' }) }
    });

    await expect(installer.install()).resolves.toBe(true);
    expect(calls.some((call) => call.includes('usermod'))).toBe(false);
  });
});
