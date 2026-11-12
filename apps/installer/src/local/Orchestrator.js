import path from 'node:path';
import dotenv from 'dotenv';
import { CertificateBootstrap } from '../platform/shared/CertificateBootstrap.js';
import { createCertificateToolInstaller } from '../platform/shared/CertificateToolInstallerFactory.js';
import { BootResult } from '../orchestration/boot/result.js';
import { EnvironmentSetup } from '../installation/EnvironmentSetup.js';
import { LtiBootstrap } from '../orchestration/boot/lti.js';
import { askConfirm } from '../orchestration/cli.js';
import { waitForCanvasReady, openBrowser, shouldAutoOpenBrowser } from './browser.js';

async function createLocalCertificateBootstrap(boot) {
  const { SSLCertificateGenerator } = await import('../../../server/src/security/SSLCertificateGenerator.js');
  const platformInstaller = createCertificateToolInstaller(process.platform, {
    boot,
    confirm: (message, defaultValue) => {
      if (!process.stdin.isTTY) return Promise.resolve(false);
      return askConfirm(message, defaultValue);
    },
    environment: process.env
  });
  return new CertificateBootstrap({
    boot,
    certificateGenerator: SSLCertificateGenerator,
    platformInstaller
  });
}


export class Orchestrator {
  constructor(boot, pluginDir, canvasDir, {
    certificateBootstrapFactory = createLocalCertificateBootstrap,
    waitForCanvasReadyFn = waitForCanvasReady,
    openBrowserFn = openBrowser,
    environment = process.env
  } = {}) {
    this.boot = boot;
    this.pluginDir = pluginDir;
    this.canvasDir = canvasDir;
    this.certificateBootstrapFactory = certificateBootstrapFactory;
    this.waitForCanvasReadyFn = waitForCanvasReadyFn;
    this.openBrowserFn = openBrowserFn;
    this.environment = environment;
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
    const canvasRes = await this.runCheck('Canvas LMS verification and installation', async () => {
      try {
        const setup = new EnvironmentSetup(this.boot, this.pluginDir, this.canvasDir);
        await setup.ensureSetup();
        // Reload the environment variables so that spawnBackend() inherits them.
        const resEnv = dotenv.config({ path: path.join(this.pluginDir, '.env'), override: true, quiet: true });
        const cEnv = resEnv.parsed ? Object.keys(resEnv.parsed).length : 0;
        this.boot.info(`Entorno local recargado desde .env (${cEnv} variables).`);
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
      throw new Error('Required TLS configuration for local Canvas is missing.');
    }

    // LTI: instala/activa solo en modo local.
    const ltiResult = await this.runCheck('LTI 1.3 initialization', async () => {
      const lti = new LtiBootstrap({ mode, log: this.boot });
      return lti.run();
    });
    if (!ltiResult.ok) throw new Error(ltiResult.message);
  }

  async ensureTlsPrerequisites() {
    try {
      const bootstrap = await this.certificateBootstrapFactory(this.boot);
      return bootstrap.ensure();
    } catch (error) {
      this.boot.warn(`Could not set up local HTTPS: ${error.message}`);
      return false;
    }
  }

  async waitForCanvasAndOpenBrowser() {
    try {
      await this.waitForCanvasReadyFn();
      this.boot.plain('');
      this.boot.plain('  √ Canvas LMS inicializado y proxy habilitado.');
      const canvasBrowserUrl = 'https://localhost:8443/login/canvas';
      if (!shouldAutoOpenBrowser(this.environment)) {
        this.boot.info('[QA-NO-BROWSER-001] Canvas is ready; automatic browser opening is suppressed only in QA mode.');
        return;
      }
      this.boot.plain('  · Abriendo Canvas con el navegador predeterminado del sistema...');
      const browserOpened = await this.openBrowserFn(canvasBrowserUrl);
      if (!browserOpened) {
        this.boot.warn('Could not request automatic browser opening.');
        this.boot.action(`Abra manualmente: ${canvasBrowserUrl}`);
      }
    } catch (err) {
      this.boot.warn('Could not detect Canvas readiness');
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
      this.boot.warn(`Could not start the Canvas TLS proxy: ${err.message}`);
      this.boot.action('El flujo LTI requiere HTTPS; instale mkcert y genere los certificados locales.');
      return false;
    }
  }

  async stopTlsProxy() {
    try {
      const { stopTlsProxy } = await import('../orchestration/tlsProxy.js');
      await stopTlsProxy();
    } catch { /* ignore */ }
  }
}
