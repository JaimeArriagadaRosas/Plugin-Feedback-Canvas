import path from 'node:path';

import { createSpinner } from 'nanospinner';

import { getPluginDirectory } from '../installation/utils/LocalWorkspacePaths.js';
import { DockerLtiConfigurator } from './DockerLtiConfigurator.js';
import { SystemTokenManager } from './SystemTokenManager.js';
import { LtiVerifier } from './LtiVerifier.js';

export function getLtiJsonPath() {
  return path.join(getPluginDirectory(), 'config', 'lti_placement.json');
}

export class LtiInstaller {
  static async verifyAndInstall() {
    const spinner = createSpinner('Checking Canvas LMS status...').start();
    if (!(await LtiVerifier.isCanvasRunning())) {
      spinner.error({ text: 'Canvas LMS is not running. Run docker compose up -d' });
      throw new Error('Canvas LMS is not running. Run docker compose up -d');
    }

    try {
      await this.ensureCanvasDependencies(spinner);
    } catch (error) {
      spinner.error({ text: `Could not prepare Canvas dependencies: ${error.message}` });
      throw error;
    }

    spinner.update({ text: 'Checking LTI tool installation...' });
    const installed = await LtiVerifier.checkLtiStatus() === 'OK';
    if (installed) {
      spinner.update({ text: 'LTI tool is already installed correctly.' });
      await SystemTokenManager.generate(spinner);
      return;
    }

    spinner.update({ text: 'LTI tool not found. Starting clean install...' });
    try {
      await DockerLtiConfigurator.cleanDatabase(spinner);
      const clientId = await DockerLtiConfigurator.injectLtiTool(getLtiJsonPath(), spinner);
      if (clientId) spinner.update({ text: `LTI_CLIENT_ID updated in .env: ${clientId}` });
      await SystemTokenManager.generate(spinner);
    } catch (error) {
      spinner.error({ text: `Critical error during LTI installation: ${error.message}` });
      throw error;
    }
  }

  static async ensureCanvasDependencies(spinner) {
    spinner.update({ text: 'Checking Canvas dependencies...' });
    const check = await DockerLtiConfigurator.runDockerCommand([
      'compose', 'exec', '-T', 'web', 'bundle', 'check'
    ]);
    if (check.success) return;

    spinner.update({ text: 'Installing Bundler plugin for Canvas...' });
    const plugin = await DockerLtiConfigurator.runDockerCommand([
      'compose', 'exec', '-T', 'web', 'bundle', 'plugin', 'install', 'bundler-multilock'
    ]);
    if (!plugin.success) throw new Error(plugin.err || 'bundler-multilock failed.');

    spinner.update({ text: 'Installing missing Ruby dependencies for Canvas...' });
    const install = await DockerLtiConfigurator.runDockerCommand([
      'compose', 'exec', '-T', '-e', 'BUNDLE_FROZEN=false', 'web', 'bundle', 'install', '--jobs=2'
    ]);
    if (!install.success) throw new Error(install.err || 'bundle install failed.');
  }

  static async runDockerCommand(args, envs = {}) {
    return DockerLtiConfigurator.runDockerCommand(args, envs);
  }

  static async generateSystemTokenIfMissing() {
    return SystemTokenManager.generate();
  }
}
