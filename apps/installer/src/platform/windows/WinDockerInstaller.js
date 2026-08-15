import path from 'node:path';
import fs from 'node:fs';
import { runCommand } from '../../installation/utils/Runner.js';

export class WinDockerInstaller {
  constructor(boot, logFile) {
    this.boot = boot;
    this.logFile = logFile;
  }

  async isInstalled() {
    const defaultWinPath = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Docker', 'Docker', 'resources', 'bin', 'docker.exe');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    return fs.existsSync(defaultWinPath);
  }

  async install() {
    this.boot.info('Downloading Docker Desktop Installer for Windows...');
    const url = 'https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe';
    const dest = path.join(process.env.TEMP || 'C:\\Windows\\Temp', 'DockerDesktopInstaller.exe');
    
    // Mitigation: Use native Windows curl.exe (faster and more efficient)
    let success, err;
    try {
      const curlRes = await runCommand('curl.exe', ['-L', '-o', dest, url], { logFile: this.logFile });
      success = curlRes.success;
      err = curlRes.err;
    } catch {
      // Fallback to powershell if curl.exe is not available
      const psRes = await runCommand('powershell', ['-Command', `Invoke-WebRequest -Uri "${url}" -OutFile "${dest}"`], { logFile: this.logFile });
      success = psRes.success;
      err = psRes.err;
    }

    if (!success) {
      this.boot.error(`Could not download Docker Desktop: ${err}`);
      return false;
    }

    this.boot.warn('Administrator (UAC) permissions will be required to install Docker.');
    this.boot.action('Please confirm the dialog box that will appear next.');
    
    // start-process with -Wait and -Verb RunAs for elevation
    const installRes = await runCommand('powershell', ['-Command', `Start-Process -FilePath "${dest}" -ArgumentList "install --quiet --accept-license" -Wait -Verb RunAs`]);
    
    if (!installRes.success) {
      this.boot.error('Installation failed (possibly canceled UAC permissions or installer failed).');
      return false;
    }

    this.boot.warn('IMPORTANT: You may need to restart your computer or log out for Docker to be functional.');
    return true;
  }

  async isUpdating() {
    try {
      const { out } = await runCommand('tasklist', ['/fi', 'imagename eq Docker Desktop Installer.exe'], { captureAll: true });
      return out && out.includes('Docker Desktop Installer.exe');
    } catch (e) {
      return false;
    }
  }
}
