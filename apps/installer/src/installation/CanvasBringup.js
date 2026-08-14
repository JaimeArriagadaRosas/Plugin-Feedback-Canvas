import { createContainerWorkspacePermissions } from '../platform/shared/ContainerWorkspacePermissionsFactory.js';
import { runCommand } from './utils/Runner.js';
import { execa } from 'execa';

const DEFAULT_HEALTH_URL = 'http://localhost:8080';

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function createDefaultHealthCheck() {
  return async (url) => {
    try {
      const response = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(5000)
      });
      return response.status >= 200 && response.status < 400;
    } catch {
      return false;
    }
  };
}

export class CanvasBringup {
  constructor(boot, canvasDir, {
    runner = runCommand,
    platform = process.platform,
    containerWorkspacePermissions,
    healthCheck = createDefaultHealthCheck(),
    healthUrl = process.env.CANVAS_HEALTH_URL || DEFAULT_HEALTH_URL,
    sleep = wait
  } = {}) {
    this.boot = boot;
    this.canvasDir = canvasDir;
    this.runner = runner;
    this.healthCheck = healthCheck;
    this.healthUrl = healthUrl;
    this.sleep = sleep;
    this.containerWorkspacePermissions = containerWorkspacePermissions ||
      createContainerWorkspacePermissions(platform, { runner });
    this.containerExecArgs = [];
  }

  async bringup() {
    this.boot.info('Starting Canvas LMS stack...');
    if (!(await this.startStack())) return false;
    if (!(await this._prepareContainerWorkspace())) return false;
    if (!(await this.ensureRubyDependencies())) return false;
    return this.waitForReady();
  }

  async startStack() {
    this.boot.info('Starting Canvas LMS containers...');
    const result = await this.runner('docker', ['compose', 'up', '-d'], { cwd: this.canvasDir });
    if (!result.success) {
      this.boot.error(`Error starting Docker Compose: ${result.err}`);
      return false;
    }
    this.boot.success('Canvas LMS containers started');
    return true;
  }

  async ensureRubyDependencies() {
    this.boot.info('Checking Canvas Ruby dependencies...');
    const check = await this._runWebCommand(['bundle', 'check']);
    if (check.success) {
      this.boot.success('Ruby dependencies ready');
      return true;
    }

    this.boot.info('Incomplete Ruby dependencies. Installing gems...');
    if (!(await this._installBundlerPlugin())) return false;

    const install = await this._runWebCommand(['bundle', 'install', '--jobs=2'], {
      extraExecArgs: ['-e', 'BUNDLE_FROZEN=false']
    });
    if (!install.success) {
      this.boot.error('Error installing Ruby dependencies (bundle install)');
      this.boot.error(`bundle install failed: ${install.out} ${install.err}`);
      return false;
    }

    const restarted = await this.runner('docker', ['compose', 'restart', 'web', 'jobs'], {
      cwd: this.canvasDir
    });
    if (!restarted.success) {
      this.boot.error(`Could not restart Canvas services: ${restarted.err}`);
      return false;
    }

    this.boot.success('Ruby dependencies installed and services restarted');
    return true;
  }

  async waitForReady(interval = 5) {
    const { createSpinner } = await import('nanospinner');
    const spinner = createSpinner('Starting Canvas logs reading...').start();
    
    const tailProcess = execa('docker', ['compose', 'logs', '-f', '--tail=0', 'web', 'jobs', 'postgres', 'redis'], {
      cwd: this.canvasDir,
      reject: false
    });

    tailProcess.stdout?.on('data', (data) => {
      const lines = data.toString().trim().split('\n');
      const lastLine = lines[lines.length - 1];
      if (lastLine) {
        let cleanLine = lastLine.replace(/^[^|]+\|\s*/, '').trim();
        cleanLine = cleanLine.substring(0, 100);
        if (cleanLine.length > 0) {
          spinner.update({ text: cleanLine });
        }
      }
    });

    while (true) {
      const web = await this.runner('docker', ['compose', 'ps', '-q', 'web'], {
        cwd: this.canvasDir,
        captureAll: true
      });
      if (web.success && web.out.trim() && await this.healthCheck(this.healthUrl)) {
        tailProcess.kill();
        spinner.success({ text: 'Canvas LMS is ready to receive requests', mark: '  √' });
        return true;
      }
      await this.sleep(interval * 1000);
    }
  }

  async _prepareContainerWorkspace() {
    const args = await this.containerWorkspacePermissions.prepare({
      canvasDir: this.canvasDir,
      logFile: null,
      boot: this.boot
    });
    if (args === null) return false;
    this.containerExecArgs = args;
    return true;
  }

  async _installBundlerPlugin() {
    const plugin = await this._runWebCommand(
      ['bundle', 'plugin', 'install', 'bundler-multilock'],
      { useWorkspacePermissions: false }
    );
    if (plugin.success) return true;
    this.boot.error(`Could not install bundler-multilock: ${plugin.err}`);
    return false;
  }

  _runWebCommand(commandArgs, {
    useWorkspacePermissions = true,
    extraExecArgs = []
  } = {}) {
    const workspaceArgs = useWorkspacePermissions ? this.containerExecArgs : [];
    return this.runner('docker', [
      'compose', 'exec', '-T', ...workspaceArgs, ...extraExecArgs, 'web', ...commandArgs
    ], { cwd: this.canvasDir });
  }
}
