import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';
import { LtiVerifier } from '../LtiVerifier.js';
import { DockerLtiConfigurator } from './DockerLtiConfigurator.js';
import { TeacherTokenGenerator } from './TeacherTokenGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LTI_JSON_PATH = path.resolve(__dirname, '../../../../../config/lti_placement.json');

export class LtiInstaller {
  static async verifyAndInstall() {
    console.log(`\n${pc.cyan('[LTI Installer]')} Verificando estado de Canvas LMS...`);
    if (!(await LtiVerifier.isCanvasRunning())) {
      throw new Error('Canvas LMS no está corriendo. Ejecute docker compose up -d');
    }

    console.log(`${pc.cyan('[LTI Installer]')} Verificando instalación de herramienta LTI...`);
    const isInstalled = await LtiVerifier.checkLtiStatus() === 'OK';

    if (isInstalled) {
      console.log(`${pc.green('[LTI Installer]')} La herramienta LTI ya está instalada correctamente (formato LTI 1.3 moderno).`);
      await TeacherTokenGenerator.generate();
      return;
    }

    console.log(`${pc.yellow('[LTI Installer]')} Herramienta no encontrada o en formato legacy. Iniciando instalación limpia LTI 1.3...`);

    try {
      await DockerLtiConfigurator.cleanDatabase();
      const clientId = await DockerLtiConfigurator.injectLtiTool(LTI_JSON_PATH);
      
      if (clientId) {
        const { updateEnvVars } = await import('../../orchestration/envWriter.js');
        const pluginDir = path.resolve(__dirname, '../../../../');
        updateEnvVars(pluginDir, { LTI_CLIENT_ID: clientId });
        console.log(`${pc.green('[LTI Installer]')} LTI_CLIENT_ID actualizado en .env a: ${clientId}`);
      }

      await TeacherTokenGenerator.generate();
    } catch (err) {
      console.error(`${pc.red('[LTI Installer]')} Error crítico durante la instalación:`);
      console.error(err.message);
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
