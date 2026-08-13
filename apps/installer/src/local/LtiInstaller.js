import path from 'node:path';

import { createSpinner } from 'nanospinner';

import { getPluginDirectory } from '../installation/utils/LocalWorkspacePaths.js';
import { DockerLtiConfigurator } from './DockerLtiConfigurator.js';
import { TeacherTokenGenerator } from './TeacherTokenGenerator.js';
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

    try {
      await this.ensureCanvasDependencies(spinner);
    } catch (error) {
      spinner.error({ text: `No se pudieron preparar las dependencias de Canvas: ${error.message}` });
      throw error;
    }

    spinner.update({ text: 'Verificando instalación de herramienta LTI...' });
    const installed = await LtiVerifier.checkLtiStatus() === 'OK';
    if (installed) {
      spinner.update({ text: 'La herramienta LTI ya está instalada correctamente.' });
      await TeacherTokenGenerator.generate(spinner);
      return;
    }

    spinner.update({ text: 'Herramienta LTI no encontrada. Iniciando instalación limpia...' });
    try {
      await DockerLtiConfigurator.cleanDatabase(spinner);
      const clientId = await DockerLtiConfigurator.injectLtiTool(getLtiJsonPath(), spinner);
      if (clientId) spinner.update({ text: `LTI_CLIENT_ID actualizado en .env: ${clientId}` });
      await TeacherTokenGenerator.generate(spinner);
    } catch (error) {
      spinner.error({ text: `Error crítico durante la instalación de LTI: ${error.message}` });
      throw error;
    }
  }

  static async ensureCanvasDependencies(spinner) {
    spinner.update({ text: 'Verificando dependencias de Canvas...' });
    const check = await DockerLtiConfigurator.runDockerCommand([
      'compose', 'exec', '-T', 'web', 'bundle', 'check'
    ]);
    if (check.success) return;

    spinner.update({ text: 'Instalando plugin de Bundler para Canvas...' });
    const plugin = await DockerLtiConfigurator.runDockerCommand([
      'compose', 'exec', '-T', 'web', 'bundle', 'plugin', 'install', 'bundler-multilock'
    ]);
    if (!plugin.success) throw new Error(plugin.err || 'Falló bundler-multilock.');

    spinner.update({ text: 'Instalando dependencias Ruby faltantes de Canvas...' });
    const install = await DockerLtiConfigurator.runDockerCommand([
      'compose', 'exec', '-T', '-e', 'BUNDLE_FROZEN=false', 'web', 'bundle', 'install', '--jobs=2'
    ]);
    if (!install.success) throw new Error(install.err || 'Falló bundle install.');
  }

  static async runDockerCommand(args, envs = {}) {
    return DockerLtiConfigurator.runDockerCommand(args, envs);
  }

  static async generateTeacherTokenIfMissing() {
    return TeacherTokenGenerator.generate();
  }
}
