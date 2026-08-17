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


    spinner.update({ text: 'Checking LTI tool installation...' });
    const installed = await LtiVerifier.checkLtiStatus() === 'OK';
    if (installed) {
      spinner.update({ text: 'The LTI tool is already installed correctly.' });
      await SystemTokenManager.generate(spinner);
      return;
    }

    spinner.update({ text: 'LTI tool not found. Starting clean installation...' });
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


  static async runDockerCommand(args, envs = {}) {
    return DockerLtiConfigurator.runDockerCommand(args, envs);
  }

  static async generateSystemTokenIfMissing() {
    return SystemTokenManager.generate();
  }
}
