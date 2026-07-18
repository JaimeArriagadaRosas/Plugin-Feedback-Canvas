import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pc from 'picocolors';
import { runDockerCommand, spawnDocker, waitForDockerProcess } from '../utils/dockerRunner.js';
import { LtiVerifier } from './LtiVerifier.js';
import { ensureTeacherToken } from './ensureTeacherToken.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CANVAS_DIR = path.resolve(__dirname, '../../../../../canvas-lms-master');
const LTI_JSON_PATH = path.resolve(__dirname, '../../../../config/lti_placement.json');
const RUBY_SCRIPT_PATH = path.join(__dirname, 'canvas_lti_1_3_installer.rb');

export class LtiInstaller {
  static async runDockerCommand(args, envs = {}) {
    return runDockerCommand(args, { cwd: CANVAS_DIR, env: { ...process.env, ...envs } });
  }

  static async isCanvasRunning() {
    try {
      const { stdout } = await this.runDockerCommand(['compose', 'ps', '-q', 'web']);
      return stdout.trim().length > 0;
    } catch (e) {
      return false;
    }
  }

  static async isLtiInstalled() {
    return (await LtiVerifier.checkLtiStatus()) === 'OK';
  }

  static async verifyAndInstall() {
    console.log(`\n${pc.cyan('[LTI Installer]')} Verificando estado de Canvas LMS...`);
    if (!(await LtiVerifier.isCanvasRunning())) {
      throw new Error('Canvas LMS no está corriendo. Ejecute docker compose up -d');
    }

    console.log(`${pc.cyan('[LTI Installer]')} Verificando instalación de herramienta LTI...`);
    const isInstalled = await this.isLtiInstalled();

    if (isInstalled) {
      console.log(`${pc.green('[LTI Installer]')} La herramienta LTI ya está instalada correctamente (formato LTI 1.3 moderno).`);
      
      console.log(`${pc.cyan('[LTI Installer]')} Asegurando que no queden rastros de cachés antiguas en los cursos...`);
      const activarBotonPath = path.resolve(__dirname, 'activar_boton_cursos.py');
      try {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);
        const pythonExecutable = process.platform === 'win32' ? 'python' : 'python3';
        const { stdout: pyStdout } = await execAsync(`"${pythonExecutable}" "${activarBotonPath}"`);
        console.log(pc.gray(pyStdout.trim()));
      } catch (e) {
         // ignore
      }
      await this.generateTeacherTokenIfMissing();
      return;
    }

    console.log(`${pc.yellow('[LTI Installer]')} Herramienta no encontrada o en formato legacy. Iniciando instalación limpia LTI 1.3...`);

    try {
      console.log(`${pc.yellow('[LTI Installer]')} Ejecutando limpiador de base de datos...`);
      const cleanerScriptPath = path.resolve(__dirname, 'canvas_db_cleaner.rb');
      const cleanerScript = await fs.readFile(cleanerScriptPath, 'utf-8');
      const cleanerProc = spawnDocker(
        ['compose', 'exec', '-T', '-e', 'DISABLE_SPRING=1', 'web', 'bundle', 'exec', 'rails', 'runner', '-'],
        { cwd: CANVAS_DIR }
      );
      cleanerProc.stdin.write(cleanerScript);
      cleanerProc.stdin.end();
      const cleanerCode = await waitForDockerProcess(cleanerProc);
      if (cleanerCode !== 0) {
        throw new Error(`Limpieza de BD falló con código ${cleanerCode}`);
      }
      console.log(`${pc.green('[LTI Installer]')} Limpieza de BD completada.`);
      const ltiJson = await fs.readFile(LTI_JSON_PATH, 'utf-8');
      const pluginUrl = process.env.VITE_BACKEND_URL || 'https://localhost:3000';
      const internalPluginUrl = process.env.INTERNAL_PLUGIN_URL || pluginUrl.replace('localhost', 'host.docker.internal');
      const globalJsUrl = `${pluginUrl}/api/canvas/canvas-logs.js`;
      // El dominio de Canvas percibido por el usuario será el proxy TLS, típicamente localhost:8443
      const canvasDomain = process.env.CANVAS_DOMAIN || 'localhost:8443';

      let rubyScript = await fs.readFile(RUBY_SCRIPT_PATH, 'utf-8');
      
      rubyScript = rubyScript.replace("ENV['LTI_PLACEMENT_JSON']", `<<~JSON_EOF\n${ltiJson}\nJSON_EOF`);
      rubyScript = rubyScript.replace("ENV['PLUGIN_URL']", `'${pluginUrl}'`);
      rubyScript = rubyScript.replace("ENV['INTERNAL_PLUGIN_URL']", `'${internalPluginUrl}'`);
      rubyScript = rubyScript.replace("ENV['CANVAS_GLOBAL_JS_URL']", `'${globalJsUrl}'`);
      rubyScript = rubyScript.replace("ENV['CANVAS_DOMAIN']", `'${canvasDomain}'`);

      console.log(`${pc.cyan('[LTI Installer]')} Inyectando script LTI 1.3 en el contenedor de Canvas...`);

      const proc = spawnDocker(
        ['compose', 'exec', '-T', '-e', 'DISABLE_SPRING=1', 'web', 'bundle', 'exec', 'rails', 'runner', '-'],
        { cwd: CANVAS_DIR }
      );

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => stdout += data.toString());
      proc.stderr.on('data', (data) => stderr += data.toString());

      proc.stdin.write(rubyScript);
      proc.stdin.end();

      await new Promise((resolve, reject) => {
        waitForDockerProcess(proc).then(async (code) => {
          if (code === 0 && stdout.includes('SUCCESS')) {
            const match = stdout.match(/LTI_CLIENT_ID:(\d+)/);
            if (match && match[1]) {
              const newClientId = match[1];
              process.env.LTI_CLIENT_ID = newClientId;
              const envPath = path.resolve(__dirname, '../../.env');
              try {
                let envContent = await fs.readFile(envPath, 'utf-8').catch(() => '');
                if (envContent.includes('LTI_CLIENT_ID=')) {
                  envContent = envContent.replace(/LTI_CLIENT_ID=\d+/, `LTI_CLIENT_ID=${newClientId}`);
                } else {
                  envContent += `\nLTI_CLIENT_ID=${newClientId}\n`;
                }
                await fs.writeFile(envPath, envContent);
                console.log(`${pc.green('[LTI Installer]')} LTI_CLIENT_ID actualizado a: ${newClientId}`);
              } catch (err) {}
            }
            resolve();
          } else {
            reject(new Error(`Fallo en rails runner (code ${code}).\nStderr: ${stderr}\nStdout: ${stdout}`));
          }
        }).catch(reject);
      });

      console.log(`${pc.green('[LTI Installer]')} Plugin instalado nativamente en Account.default.`);

      if (stdout.includes('GLOBAL_JS_UPDATED')) {
        console.log(`${pc.yellow('[LTI Installer]')} JavaScript Global actualizado. Compilando BrandConfigs (esto puede tomar 1 minuto)...`);
        await this.runDockerCommand(['compose', 'exec', '-T', 'web', 'bundle', 'exec', 'rake', 'brand_configs:generate_and_upload_all']);
        console.log(`${pc.green('[LTI Installer]')} BrandConfigs recompilados.`);
      }

      console.log(`${pc.cyan('[LTI Installer]')} Forzando la activación del botón en todos los menús de cursos existentes...`);
      const activarBotonPath = path.resolve(__dirname, 'activar_boton_cursos.py');
      try {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);
        const pythonExecutable = process.platform === 'win32' ? 'python' : 'python3';
        const { stdout: pyStdout } = await execAsync(`"${pythonExecutable}" "${activarBotonPath}"`);
        console.log(`${pc.green('[LTI Installer]')} Botón LTI activado en la navegación de los cursos.`);
        console.log(pc.gray(pyStdout.trim()));
      } catch (e) {
        console.log(`${pc.yellow('[LTI Installer]')} Advertencia: No se pudo auto-activar en los cursos existentes. Error: ${e.message}`);
      }

      await this.generateTeacherTokenIfMissing();

    } catch (err) {
      console.error(`${pc.red('[LTI Installer]')} Error crítico durante la instalación:`);
      console.error(err.message);
      throw err;
    }
  }

  static async generateTeacherTokenIfMissing() {
    try {
      console.log(`${pc.cyan('[LTI Installer]')} Generando/verificando token de API del profesor para Canvas Local...`);
      const data = await ensureTeacherToken(process.env.CANVAS_TEACHER_EMAIL || 'profesor@canvas.local');
      console.log(`${pc.green('[LTI Installer]')} Token del profesor listo (canvas_user_id=${data.user_id}). Guardado en perfiles_data.json.`);
    } catch (e) {
      console.log(`${pc.yellow('[LTI Installer]')} Advertencia: No se pudo generar el token del profesor. Los cursos podrían fallar con 401. Error: ${e.message}`);
    }
  }
}
