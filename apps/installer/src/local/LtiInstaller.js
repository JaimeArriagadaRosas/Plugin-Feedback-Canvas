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
    const spinner = createSpinner('Verificando estado de Canvas LMS...').start();
    if (!(await LtiVerifier.isCanvasRunning())) {
      spinner.error({ text: 'Canvas LMS no está corriendo. Ejecute docker compose up -d' });
      throw new Error('Canvas LMS no está corriendo. Ejecute docker compose up -d');
    }


    spinner.update({ text: 'Verificando instalación de herramienta LTI...' });
    const installed = await LtiVerifier.checkLtiStatus() === 'OK';
    if (installed) {
      spinner.update({ text: 'La herramienta LTI ya está instalada correctamente.' });
      await SystemTokenManager.generate(spinner);
      return;
    }

    spinner.update({ text: 'Herramienta LTI no encontrada. Iniciando instalación limpia...' });
    try {
      await DockerLtiConfigurator.cleanDatabase(spinner);
      const clientId = await DockerLtiConfigurator.injectLtiTool(getLtiJsonPath(), spinner);
      if (clientId) spinner.update({ text: `LTI_CLIENT_ID actualizado en .env: ${clientId}` });
      await SystemTokenManager.generate(spinner);
    } catch (error) {
      spinner.error({ text: `Error crítico durante la instalación de LTI: ${error.message}` });
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
