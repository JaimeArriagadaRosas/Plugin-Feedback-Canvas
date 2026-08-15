import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export class WindowsDockerMemoryConfigurator {
  constructor({
    homedir = () => os.homedir(),
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    readFile = file => fs.readFileSync(file, 'utf8'),
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    writeFile = (file, content) => fs.writeFileSync(file, content),
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    exists = file => fs.existsSync(file),
    shutdownWsl = () => execFileSync('wsl', ['--shutdown'], { stdio: 'ignore' }),
    delay = ms => new Promise(resolve => setTimeout(resolve, ms))
  } = {}) {
    this.homedir = homedir;
    this.readFile = readFile;
    this.writeFile = writeFile;
    this.exists = exists;
    this.shutdownWsl = shutdownWsl;
    this.delay = delay;
  }

  _withMemorySetting(content) {
    if (/^memory=.*$/m.test(content)) return content.replace(/^memory=.*$/m, 'memory=8GB');
    if (content.includes('[wsl2]')) return content.replace('[wsl2]', '[wsl2]\nmemory=8GB');
    return `${content.trimEnd()}\n\n[wsl2]\nmemory=8GB\n`;
  }

  async configure(log) {
    const configPath = path.join(this.homedir(), '.wslconfig');
    const current = this.exists(configPath) ? this.readFile(configPath) : '';
    this.writeFile(configPath, this._withMemorySetting(current));
    try {
      this.shutdownWsl();
    } catch (error) {
      log.debug('Could not automatically restart WSL.', { error: error.message });
    }
    log.info('Configuración de WSL actualizada. Esperando el reinicio del runtime (8s)...');
    await this.delay(8000);
  }
}
