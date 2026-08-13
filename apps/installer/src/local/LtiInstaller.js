import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSpinner } from 'nanospinner';
import { LtiVerifier } from './LtiVerifier.js';
import { DockerLtiConfigurator } from './DockerLtiConfigurator.js';
import { TeacherTokenGenerator } from './TeacherTokenGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LTI_JSON_PATH = path.resolve(__dirname, '../../../../../config/lti_placement.json');

export class LtiInstaller {
  static async verifyAndInstall() {
    const spinner = createSpinner('Verificando estado de Canvas LMS...').start();
    
    if (!(await LtiVerifier.isCanvasRunning())) {
      spinner.error({ text: 'Canvas LMS no está corriendo. Ejecute docker compose up -d' });
      throw new Error('Canvas LMS no está corriendo. Ejecute docker compose up -d');
    }

    spinner.update({ text: 'Verificando y corrigiendo dependencias de Canvas LMS (bundler-multilock)...' });
    try {
      await DockerLtiConfigurator.runDockerCommand(['compose', 'exec', '-T', 'web', 'bundle', 'plugin', 'install', 'bundler-multilock']);
      spinner.update({ text: 'Instalando dependencias faltantes (bundle install) en Canvas LMS...' });
      await DockerLtiConfigurator.runDockerCommand(['compose', 'exec', '-T', 'web', 'bundle', 'install']);
    } catch (e) {
      // Ignorar si falla, puede que ya esté instalado o el contenedor use otra versión.
    }

    spinner.update({ text: 'Verificando instalacion de herramienta LTI...' });
    const isInstalled = await LtiVerifier.checkLtiStatus() === 'OK';

    if (isInstalled) {
      spinner.update({ text: 'La herramienta LTI ya esta instalada correctamente (formato LTI 1.3 moderno).' });
      await TeacherTokenGenerator.generate(spinner);
      return;
    }

    spinner.update({ text: 'Herramienta no encontrada o en formato legacy. Iniciando instalacion limpia LTI 1.3...' });

    try {
      await DockerLtiConfigurator.cleanDatabase(spinner);
      const clientId = await DockerLtiConfigurator.injectLtiTool(LTI_JSON_PATH, spinner);
      
      if (clientId) {
        spinner.update({ text: `LTI_CLIENT_ID actualizado en .env a: ${clientId}` });
      }

      await TeacherTokenGenerator.generate(spinner);
    } catch (err) {
      spinner.error({ text: `Error critico durante la instalacion de LTI: ${err.message}` });
      throw err;
    }
  }

  // Se mantiene para retrocompatibilidad con tests o dependencias externas
  static async runDockerCommand(args, envs = {}) {
    return DockerLtiConfigurator.runDockerCommand(args, envs);
  }

  static async generateTeacherTokenIfMissing() {
    return TeacherTokenGenerator.generate();
  }
}
