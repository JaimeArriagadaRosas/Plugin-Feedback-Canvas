import fs from 'node:fs';
import os from 'node:os';

function readLinuxVersion() {
  try {
    return fs.readFileSync('/proc/version', 'utf8');
  } catch {
    return '';
  }
}

export class PlatformProbe {
  constructor({
    platform = () => os.platform(),
    release = () => os.release(),
    env = process.env,
    readProcVersion = readLinuxVersion
  } = {}) {
    this.platform = platform;
    this.release = release;
    this.env = env;
    this.readProcVersion = readProcVersion;
  }

  inspect() {
    const name = this.platform();
    const procVersion = name === 'linux' ? this.readProcVersion() : '';
    const isWsl = name === 'linux' && Boolean(
      this.env.WSL_DISTRO_NAME ||
      this.env.WSL_INTEROP ||
      /microsoft|wsl/i.test(procVersion)
    );

    return {
      name,
      release: this.release(),
      isWindows: name === 'win32',
      isMac: name === 'darwin',
      isLinux: name === 'linux',
      isWsl,
      distro: isWsl ? (this.env.WSL_DISTRO_NAME || 'WSL') : null
    };
  }
}
