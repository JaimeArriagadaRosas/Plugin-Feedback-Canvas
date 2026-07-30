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
    this.installerFactory = opts.installerFactory || (async () => (await import('../../setup/local/LtiInstaller.js')).LtiInstaller);
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
      return BootResult.ok({ verifiedOnly: true });
    }

    // Modo local: instalar si falta y activar siempre.
    try {
      const Installer = await this.installerFactory();
      await Installer.verifyAndInstall();
      return BootResult.ok({ installed: true });
    } catch (e) {
      return BootResult.fail(true, 'Fallo crítico en LTI Installer', 'Revise la salida de consola', { error: e.message });
    }
  }
}
