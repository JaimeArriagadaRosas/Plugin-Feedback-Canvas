import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { runCommand } from '../../installation/utils/Runner.js';
import { askConfirm } from '../../orchestration/cli.js';

export class MacDockerInstaller {
  constructor(boot, logFile) {
    this.boot = boot;
    this.logFile = logFile;
  }

  async isInstalled() {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    return fs.existsSync('/Applications/Docker.app/Contents/Resources/bin/docker') || fs.existsSync('/Applications/OrbStack.app');
  }

  async install() {
    this.boot.info('');
    this.boot.warn('Recommendation for macOS: OrbStack is a faster alternative to Docker that consumes less battery and RAM.');
    
    const hasBrew = (await runCommand('brew', ['--version'])).success;
    
    if (hasBrew) {
      const useOrbstack = await askConfirm('Do you want to install OrbStack via Homebrew instead of Docker Desktop?');
      
      if (useOrbstack) {
        this.boot.info('Downloading and installing OrbStack (Homebrew)...');
        const { success, err } = await runCommand('brew', ['install', '--cask', 'orbstack'], { logFile: this.logFile });
        if (!success) {
          this.boot.error(`Failed installing OrbStack via brew: ${err}`);
          this.boot.action('Please install it manually from https://orbstack.dev/');
          return false;
        }
        this.boot.info('Starting OrbStack...');
        runCommand('open', ['-a', 'OrbStack']);
        this.boot.warn('IMPORTANT: Finish the guided configuration in the OrbStack window.');
        return true;
      }
    } else {
      this.boot.info('Note: Homebrew is not installed. OrbStack requires manual installation. Proceeding with Docker Desktop.');
    }

    // Mitigation: Dynamically detect architecture for Apple Silicon (M1/M2/M3)
    const arch = os.arch() === 'arm64' ? 'arm64' : 'amd64';
    this.boot.info(`Downloading Docker Desktop for macOS (Architecture: ${arch})...`);
    
    const url = `https://desktop.docker.com/mac/main/${arch}/Docker.dmg`;
    const dest = path.join(os.tmpdir(), 'Docker.dmg');
    
    const { success, err } = await runCommand('curl', ['-L', '-o', dest, url], { logFile: this.logFile });
    if (!success) {
      this.boot.error(`Could not download Docker Desktop: ${err}`);
      return false;
    }

    this.boot.info('Mounting and installing Docker Desktop in /Applications...');
    await runCommand('hdiutil', ['attach', dest]);
    await runCommand('cp', ['-R', '/Volumes/Docker/Docker.app', '/Applications']);
    await runCommand('hdiutil', ['detach', '/Volumes/Docker']);
    
    // Mitigation: Gatekeeper warning (impossibility of real silent install)
    this.boot.warn('ATTENTION: macOS will block silent execution for security (Gatekeeper).');
    this.boot.action('Docker will open now. YOU MUST confirm the system security dialogs to complete the installation.');
    
    runCommand('open', ['-a', 'Docker']);
    return true;
  }

  async isUpdating() {
    return false;
  }
}
