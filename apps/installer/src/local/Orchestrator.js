import path from 'node:path';
import dotenv from 'dotenv';
import { BootResult } from '../orchestration/boot/result.js';
import { EnvironmentSetup } from '../installation/EnvironmentSetup.js';
import { LtiBootstrap } from '../orchestration/boot/lti.js';
import { waitForCanvasReady, openBrowser } from './browser.js';

export class Orchestrator {
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
        const resEnv = dotenv.config({ path: path.join(this.pluginDir, '.env'), override: true, quiet: true });
        const cEnv = resEnv.parsed ? Object.keys(resEnv.parsed).length : 0;
        this.boot.plain(`  · injected env (${cEnv}) from .env // tip: secrets for agents [www.dotenvx.com]`);
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
    if (!(await this.ensureTlsPrerequisites())) {
      throw new Error('Falta la configuración TLS requerida para Canvas Local.');
    }

    // LTI: instala/activa solo en modo local.
    const ltiResult = await this.runCheck('Inicialización LTI 1.3', async () => {
      const lti = new LtiBootstrap({ mode, log: this.boot });
      return lti.run();
    });
    if (!ltiResult.ok) throw new Error(ltiResult.message);
  }

  async ensureTlsPrerequisites() {
    try {
      const { assertTlsProxyConfiguration } = await import('./TlsProxyServer.js');
      assertTlsProxyConfiguration();
      return true;
    } catch (error) {
      this.boot.warn(`No se encontró una configuración TLS válida: ${error.message}`);
      this.boot.action('Instale mkcert y genere certificados para localhost antes de configurar LTI.');
      return false;
    }
  }

  async waitForCanvasAndOpenBrowser() {
    try {
      await waitForCanvasReady();
      this.boot.plain('');
      this.boot.plain('  √ Canvas LMS inicializado y proxy habilitado.');
      const canvasBrowserUrl = 'https://localhost:8443/login/canvas';
      this.boot.plain(`  · Abriendo ${canvasBrowserUrl} ...`);
      await openBrowser(canvasBrowserUrl);
    } catch (err) {
      this.boot.warn('No se pudo detectar que Canvas estuviera listo');
      this.boot.warn(err.message);
      this.boot.action('Abra manualmente: https://localhost:8443/');
    }
  }

  async startTlsProxy() {
    try {
      const { startTlsProxy } = await import('../orchestration/tlsProxy.js');
      await startTlsProxy();
      return true;
    } catch (err) {
      this.boot.warn(`No se pudo iniciar el proxy TLS para Canvas: ${err.message}`);
      this.boot.action('El flujo LTI requiere HTTPS; instale mkcert y genere los certificados locales.');
      return false;
    }
  }

  async stopTlsProxy() {
    try {
      const { stopTlsProxy } = await import('../orchestration/tlsProxy.js');
      stopTlsProxy();
    } catch { /* ignore */ }
  }
}
