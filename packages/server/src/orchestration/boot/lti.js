import { runDockerCommand } from '../../utils/dockerRunner.js';
import { LtiVerifier } from '../../setup/LtiVerifier.js';
import { BootResult } from './result.js';
import pc from 'picocolors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CANVAS_DIR = path.resolve(__dirname, '../../../../../../canvas-lms-master');

/**
 * LtiBootstrap — Encapsula la inicialización LTI 1.3.
 *
 * GARANTÍAS (requeridas por la auditoría):
 *  1. NUNCA se rompe el botón "Feedback": la activación de visibilidad en los
 *     cursos (activar_boton_cursos) se ejecuta SIEMPRE que Canvas esté vivo,
 *     tanto si la tool ya existe como si se acaba de instalar.
 *  2. Solo se instala/inyecta cuando corresponde (modo Canvas Local Docker).
 *     En modos LTI real (1) o API (2) NO se toca la instalación: el tool ya
 *     está configurado en la instancia de Canvas del usuario.
 *  3. Degradación elegante: si la activación del botón falla, se reporta como
 *     advertencia (no crítico) y se sugiere acción manual; el arranque continúa.
 */
export class LtiBootstrap {
  /**
   * @param {object} opts
   * @param {string} opts.mode modo de arranque ('1'|'2'|'3')
   * @param {object} log BootLogger
   * @param {Function} opts.installerFactory fábrica de LtiInstaller (inyectable para test)
   */
  constructor(opts) {
    this.mode = opts.mode;
    this.log = opts.log;
    this.installerFactory = opts.installerFactory || (async () => (await import('../../setup/LtiInstaller.js')).LtiInstaller);
    this.shouldInstall = this.mode === '3';
  }

  async _canvasRunning() {
    try {
      const { stdout } = await runDockerCommand(['compose', 'ps', '-q', 'web'], { cwd: CANVAS_DIR });
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  async _activateButton() {
    const scriptPath = path.resolve(__dirname, '../../setup/activar_boton_cursos.py');
    const pythonExecutable = process.platform === 'win32' ? 'python' : 'python3';
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      const { stdout } = await execAsync(`"${pythonExecutable}" "${scriptPath}"`);
      this.log.debug(stdout.trim());
      if (stdout.includes('ACTIVACION_COMPLETA') || stdout.includes('LTI_NO_ENCONTRADO')) {
        // LTI_NO_ENCONTRADO => la tool no existe aún; se activará tras instalar.
        return !stdout.includes('LTI_NO_ENCONTRADO');
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Ejecuta el flujo LTI. En modo no-local solo verifica; en modo local
   * instala (si falta) y siempre activa el botón.
   */
  async run() {
    const running = await this._canvasRunning();
    if (!running) {
      if (this.shouldInstall) {
        // La capa Python de setup levantará Canvas; diferimos la activación.
        this.log.warn('Canvas no está corriendo todavía; la activación LTI se hará tras levantar el stack.');
        return BootResult.warn('LTI diferido (Canvas no disponible aún)',
          'Se activará automáticamente una vez que Canvas Local esté listo.');
      }
      this.log.info('Modo no-local: no se requiere instalación LTI local.');
      return BootResult.ok({ skipped: true });
    }

    if (!this.shouldInstall) {
      this.log.info('Modo LTI/API real: se asume el tool LTI ya configurado en Canvas.');
      const activated = await this._activateButton();
      if (!activated) {
        this.log.warn('No se pudo confirmar la activación del botón Feedback en este entorno.');
      }
      return BootResult.ok({ verifiedOnly: true });
    }

    // Modo local: instalar si falta y activar siempre.
    const status = await LtiVerifier.checkLtiStatus();
    if (status === 'OK') {
      this.log.success('Herramienta LTI 1.3 ya instalada (formato moderno).');
    } else {
      this.log.info('Instalando herramienta LTI 1.3 en Canvas Local...');
      const Installer = await this.installerFactory();
      await Installer.verifyAndInstall();
    }

    const activated = await this._activateButton();
    if (activated) {
      this.log.success('Botón "Feedback" activado en la navegación de cursos.');
      return BootResult.ok({ installed: true, buttonActivated: true });
    }

    this.log.warn('No se pudo auto-activar el botón Feedback en cursos existentes.');
    this.log.action('Actívelo manualmente en Canvas: Curso > Settings > Apps > Feedback.');
    return BootResult.warn('Botón Feedback no auto-activado',
      'Actívelo manualmente en Canvas (Curso > Settings > Apps). No bloquea el arranque.');
  }
}
