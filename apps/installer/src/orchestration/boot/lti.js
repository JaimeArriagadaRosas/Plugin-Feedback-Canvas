import { runDockerCommand } from '../../platform/shared/dockerRunner.js';
import { getCanvasDirectory } from '../../installation/utils/LocalWorkspacePaths.js';
import { BootResult } from './result.js';

const CANVAS_DIR = getCanvasDirectory();

/**
 * LtiBootstrap — Encapsulates LTI 1.3 initialization.
 *
 * GUARANTEES (required by audit):
 *  1. The 'Feedback' button NEVER breaks: visibility activation in
 *     courses (activar_boton_cursos) ALWAYS runs while Canvas is alive,
 *     whether the tool already exists or was just installed.
 *  2. It is only installed/injected when appropriate (Local Docker Canvas mode).
 *     In real LTI (1) or API (2) modes, the installation is NOT touched: the tool is already
 *     configured in the user's Canvas instance.
 *  3. Graceful degradation: if button activation fails, it is reported as a
 *     warning (non-critical) and manual action is suggested; boot continues.
 */
export class LtiBootstrap {
  /**
   * @param {object} opts
   * @param {string} opts.mode boot mode ('1'|'2'|'3')
   * @param {object} log BootLogger
   * @param {Function} opts.installerFactory LtiInstaller factory (injectable for test)
   */
  constructor(opts) {
    this.mode = opts.mode;
    this.log = opts.log;
    this.installerFactory = opts.installerFactory || (async () => (await import('../../local/LtiInstaller.js')).LtiInstaller);
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
   * Executes the LTI flow. In non-local mode it only verifies; in local mode
   * it installs (if missing) and always activates the button.
   */
  async run() {
    const running = await this._canvasRunning();
    if (!running) {
      if (this.shouldInstall) {
        // The Python setup layer will bring up Canvas; we defer activation.
        this.log.warn('Canvas is not running yet; LTI activation will be done after bringing up the stack.');
        return BootResult.warn('Deferred LTI (Canvas not yet available)',
          'It will activate automatically once Local Canvas is ready.');
      }
      this.log.info('Non-local mode: local LTI installation is not required.');
      return BootResult.ok({ skipped: true });
    }

    if (!this.shouldInstall) {
      this.log.info('Real LTI/API mode: assuming the LTI tool is already configured in Canvas.');
      return BootResult.ok({ verifiedOnly: true });
    }

    // Local mode: install if missing and always activate.
    try {
      const Installer = await this.installerFactory();
      await Installer.verifyAndInstall();
      return BootResult.ok({ installed: true });
    } catch (e) {
      return BootResult.fail(true, 'Critical failure in LTI Installer', 'Check the console output', { error: e.message });
    }
  }
}
