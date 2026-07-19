import path from 'node:path';
import dotenv from 'dotenv';
import { BootResult } from '../../orchestration/boot/result.js';
import { EnvironmentSetup } from '../../orchestration/boot/setup/EnvironmentSetup.js';
import { LtiBootstrap } from '../../orchestration/boot/lti.js';
import { waitForCanvasReady, openBrowser } from './browser.js';

export class LocalDevOrchestrator {
  constructor(boot, pluginDir, canvasDir) {
    this.boot = boot;
    this.pluginDir = pluginDir;
    this.canvasDir = canvasDir;
  }

  async runCheck(stageName, checkFn) {
    return this.boot.withStage(stageName, async () => {
      const result = await checkFn();
      if (result.degraded && result.ok) {
        this.boot.warn(result.message);
        if (result.fix) this.boot.action(result.fix);
      } else if (!result.ok) {
        this.boot.error(result.message);
        if (result.fix) this.boot.action(result.fix);
      }
      return result;
    });
  }

  async setupLocalCanvas(mode) {
    // Verificación + instalación de Canvas (capa Python). Crítica.
    const canvasRes = await this.runCheck('Verificación e instalación de Canvas LMS', async () => {
      try {
        const setup = new EnvironmentSetup(this.boot, this.pluginDir, this.canvasDir);
        await setup.ensureSetup();
        // Reload the environment variables so that spawnBackend() inherits them.
        dotenv.config({ path: path.join(this.pluginDir, '.env'), override: true });
        return BootResult.ok({ installed: true });
      } catch (e) {
        this.boot.error(e.message);
        if (e.output) {
          e.output.split('\n').filter(l => l.trim()).slice(-20).forEach(l => this.boot.debug(l));
        }
        throw e;
      }
    });

    if (!canvasRes.ok) {
      throw new Error('Canvas Setup Failed');
    }

    // LTI: instala/activa solo en modo local.
    await this.runCheck('Inicialización LTI 1.3', async () => {
      const lti = new LtiBootstrap({ mode, log: this.boot });
      return lti.run();
    });
  }

  async waitForCanvasAndOpenBrowser() {
    await this.boot.withStage('Canvas LMS (espera de listo)', async () => {
      const spinner = (await import('nanospinner')).createSpinner('Canvas LMS inicializándose en segundo plano...');
      spinner.start();
      try {
        await waitForCanvasReady();
        spinner.success({ text: 'Canvas LMS listo' });
        const canvasBrowserUrl = 'https://localhost:8443/login/canvas';
        this.boot.info(`Abriendo ${canvasBrowserUrl} ...`);
        await openBrowser(canvasBrowserUrl);
      } catch (err) {
        spinner.error({ text: 'No se pudo detectar que Canvas estuviera listo' });
        this.boot.warn(err.message);
        this.boot.action('Abra manualmente: https://localhost:8443/');
      }
    });
  }

  async startTlsProxy() {
    try {
      const { startTlsProxy } = await import('./tlsProxy.js');
      startTlsProxy();
    } catch (err) {
      this.boot.warn(`No se pudo iniciar el proxy TLS para Canvas: ${err.message}`);
      this.boot.action('El flujo LTI requiere HTTPS; ejecute scripts/tls-proxy manualmente.');
    }
  }

  async stopTlsProxy() {
    try {
      const { stopTlsProxy } = await import('./tlsProxy.js');
      stopTlsProxy();
    } catch { /* ignore */ }
  }
}
