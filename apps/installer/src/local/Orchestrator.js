import path from 'node:path';
import dotenv from 'dotenv';
import { CertificateBootstrap } from '../platform/shared/CertificateBootstrap.js';
import { createCertificateToolInstaller } from '../platform/shared/CertificateToolInstallerFactory.js';
import { BootResult } from '../orchestration/boot/result.js';
import { EnvironmentSetup } from '../installation/EnvironmentSetup.js';
import { LtiBootstrap } from '../orchestration/boot/lti.js';
import { askConfirm } from '../orchestration/cli.js';
import { waitForCanvasReady, openBrowser } from './browser.js';

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
    certificateBootstrapFactory = createLocalCertificateBootstrap
  } = {}) {
    this.boot = boot;
    this.pluginDir = pluginDir;
    this.canvasDir = canvasDir;
    this.certificateBootstrapFactory = certificateBootstrapFactory;
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
    // Canvas verification + installation (Python layer). Critical.
    const canvasRes = await this.runCheck('Canvas LMS Verification and Installation', async () => {
      try {
        const setup = new EnvironmentSetup(this.boot, this.pluginDir, this.canvasDir);
        await setup.ensureSetup();
        // Reload the environment variables so that spawnBackend() inherits them.
        const resEnv = dotenv.config({ path: path.join(this.pluginDir, '.env'), override: true, quiet: true });
        const cEnv = resEnv.parsed ? Object.keys(resEnv.parsed).length : 0;
        this.boot.info(`Local environment reloaded from .env (${cEnv} variables).`);
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
      throw new Error('Required TLS configuration for Canvas Local is missing.');
    }

    // LTI: install/activate only in local mode.
    const ltiResult = await this.runCheck('LTI 1.3 Initialization', async () => {
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
      this.boot.warn(`Could not prepare local HTTPS: ${error.message}`);
      return false;
    }
  }

  async waitForCanvasAndOpenBrowser() {
    try {
      await waitForCanvasReady();
      this.boot.plain('');
      this.boot.plain('  √ Canvas LMS initialized and proxy enabled.');
      const canvasBrowserUrl = 'https://localhost:8443/login/canvas';
      this.boot.plain('  · Opening Canvas with the default system browser...');
      const browserOpened = await openBrowser(canvasBrowserUrl);
      if (!browserOpened) {
        this.boot.warn('Could not request automatic browser opening.');
        this.boot.action(`Open manually: ${canvasBrowserUrl}`);
      }
    } catch (err) {
      this.boot.warn('Could not detect that Canvas was ready');
      this.boot.warn(err.message);
      this.boot.action('Open manually: https://localhost:8443/');
    }
  }

  async startTlsProxy() {
    try {
      const { startTlsProxy } = await import('../orchestration/tlsProxy.js');
      await startTlsProxy();
      return true;
    } catch (err) {
      this.boot.warn(`Could not start TLS proxy for Canvas: ${err.message}`);
      this.boot.action('The LTI flow requires HTTPS; install mkcert and generate the local certificates.');
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
