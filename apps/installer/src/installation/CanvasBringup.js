import { runCommand } from './utils/Runner.js';
import { execa } from 'execa';
import { ExecutionContext } from '../platform/shared/ContainerExecutionPolicy.js';

const DEFAULT_HEALTH_URL = 'http://localhost:8080';

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function createDefaultHealthCheck() {
  let consecutive500 = 0;
  const start = Date.now();
  return async (url) => {
    try {
      const response = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(5000)
      });
      if (response.status >= 500 && response.status < 600) {
        consecutive500++;
        if (consecutive500 >= 5) {
          return { ok: false, status: response.status, error: `HTTP ${response.status} persistente devuelto por Canvas.`, duration: Date.now() - start };
        }
      } else {
        consecutive500 = 0;
      }
      return { ok: response.status >= 200 && response.status < 400, status: response.status, error: null, duration: Date.now() - start };
    } catch (e) {
      consecutive500 = 0;
      return { ok: false, status: 0, error: e.message, duration: Date.now() - start };
    }
  };
}

export class CanvasBringup {
  constructor(boot, canvasDir, {
    runner = runCommand,
    platform = process.platform,
    dockerProfile = null,
    healthCheck = createDefaultHealthCheck(),
    healthUrl = process.env.CANVAS_HEALTH_URL || DEFAULT_HEALTH_URL,
    sleep = wait
  } = {}) {
    this.boot = boot;
    this.canvasDir = canvasDir;
    this.runner = runner;
    this.healthCheck = healthCheck;
    this.healthUrl = healthUrl;
    this.sleep = sleep;
    this.dockerProfile = dockerProfile;
    this.containerExecArgs = [];
  }

  async bringup() {
    this.boot.info('Iniciando stack de Canvas LMS...');
    if (!(await this.startStack())) return false;
    if (!(await this._prepareContainerWorkspace())) return false;

    const { AssetBuilder } = await import('./installers/AssetBuilder.js');
    const builder = new AssetBuilder(this.boot, null, String(this.canvasDir), { dockerProfile: this.dockerProfile });
    if (!(await builder.setupAssets())) return false;

    const { CanvasWorkspaceProbe } = await import('./CanvasWorkspaceProbe.js');
    const probe = new CanvasWorkspaceProbe(this.boot, this.canvasDir, { runner: this.runner, dockerProfile: this.dockerProfile });
    const probeResult = await probe.runChecks();
    if (!probeResult.ok) return false;

    if (!(await this.ensureRubyDependencies())) return false;
    return this.waitForReady();
  }

  async startStack() {
    this.boot.info('Iniciando contenedores de Canvas LMS...');
    const result = await this.runner('docker', ['compose', 'up', '-d'], { cwd: this.canvasDir });
    if (!result.success) {
      this.boot.error(`Error al iniciar Docker Compose: ${result.err}`);
      return false;
    }
    this.boot.success('Contenedores de Canvas LMS iniciados');
    return true;
  }

  async ensureRubyDependencies() {
    this.boot.info('Verificando dependencias Ruby de Canvas...');
    const check = await this._runWebCommand(['bundle', 'check']);
    if (check.success) {
      this.boot.success('Dependencias Ruby listas');
      return true;
    }

    this.boot.info('Dependencias Ruby incompletas. Instalando gems...');
    if (!(await this._installBundlerPlugin())) return false;

    const install = await this._runWebCommand(['bundle', 'install', '--jobs=2'], {
      extraExecArgs: ['-e', 'BUNDLE_FROZEN=false']
    });
    if (!install.success) {
      this.boot.error('Error instalando dependencias Ruby (bundle install)');
      this.boot.error(`bundle install falló: ${install.out} ${install.err}`);
      return false;
    }

    const restarted = await this.runner('docker', ['compose', 'restart', 'web', 'jobs'], {
      cwd: this.canvasDir
    });
    if (!restarted.success) {
      this.boot.error(`No se pudieron reiniciar los servicios de Canvas: ${restarted.err}`);
      return false;
    }

    this.boot.success('Dependencias Ruby instaladas y servicios reiniciados');
    return true;
  }

  async waitForReady(timeoutSeconds = 300, interval = 5) {
    const { createSpinner } = await import('nanospinner');
    const spinner = createSpinner('Iniciando lectura de logs de Canvas...').start();
    
    const tailProcess = execa('docker', ['compose', 'logs', '-f', '--tail=0', 'web', 'jobs', 'postgres', 'redis'], {
      cwd: this.canvasDir,
      reject: false
    });

    tailProcess.stdout?.on('data', (data) => {
      const lines = data.toString().trim().split('\n');
      const lastLine = lines[lines.length - 1];
      if (lastLine) {
        let cleanLine = lastLine.replace(/^[^|]+\|\s*/, '').trim();
        cleanLine = cleanLine.substring(0, 100);
        if (cleanLine.length > 0) {
          spinner.update({ text: cleanLine });
        }
      }
    });

    const maxAttempts = Math.ceil(timeoutSeconds / interval);
    let attempts = 0;

    while (attempts < maxAttempts) {
      const psResult = await this.runner('docker', ['compose', 'ps', '--format', 'json', 'web'], {
        cwd: this.canvasDir,
        captureAll: true
      });
      
      let isRunning = false;
      let isExit = false;
      if (psResult.success && psResult.out) {
        try {
          const containers = psResult.out.trim().split('\n').filter(Boolean).map(JSON.parse);
          if (containers.length > 0) {
            const state = containers[0].State;
            if (state === 'running') isRunning = true;
            if (state === 'exited') isExit = true;
          }
        } catch (e) {
          isRunning = psResult.out.trim().length > 0;
        }
      }

      if (isExit) {
        tailProcess.kill();
        spinner.error({ text: 'El contenedor web de Canvas se detuvo inesperadamente.', mark: '  ×' });
        await this._printEarlyDiagnosis();
        return false;
      }

      try {
        if (isRunning) {
          const healthResult = await this.healthCheck(this.healthUrl);
          if (healthResult.ok) {
            tailProcess.kill();
            spinner.success({ text: 'Canvas LMS está listo para recibir solicitudes', mark: '  √' });
            return true;
          } else if (healthResult.error && healthResult.error.includes('persistente')) {
            throw new Error(healthResult.error);
          }
        }
      } catch (err) {
        tailProcess.kill();
        spinner.error({ text: `El arranque falló: ${err.message}`, mark: '  ×' });
        await this._printEarlyDiagnosis();
        return false;
      }
      
      attempts++;
      await this.sleep(interval * 1000);
    }
    
    tailProcess.kill();
    spinner.error({ text: 'Tiempo de espera agotado al iniciar Canvas LMS.', mark: '  ×' });
    await this._printEarlyDiagnosis();
    return false;
  }

  async _printEarlyDiagnosis() {
    const logs = await this.runner('docker', ['compose', 'logs', '--tail=150', 'web'], { cwd: this.canvasDir, captureAll: true });
    if (logs.success && logs.out) {
      const { analyzeLogString, printDiagnosisBox } = await import('./utils/Diagnostics.js');
      const diagnosis = analyzeLogString(logs.out);
      if (diagnosis) printDiagnosisBox(this.boot, diagnosis);
    }
  }

  async _prepareContainerWorkspace() {
    const { ContainerExecutionPolicy, ExecutionContext } = await import('../platform/shared/ContainerExecutionPolicy.js');
    this.executionPolicy = new ContainerExecutionPolicy(this.dockerProfile);
    this.ExecutionContext = ExecutionContext;
    return true;
  }

  async _installBundlerPlugin() {
    const plugin = await this._runWebCommand(
      ['bundle', 'plugin', 'install', 'bundler-multilock'],
      { context: ExecutionContext.CONTAINER_CACHE_WRITE }
    );
    if (plugin.success) return true;
    this.boot.error(`No se pudo instalar bundler-multilock: ${plugin.err}`);
    return false;
  }

  _runWebCommand(commandArgs, {
    context = ExecutionContext.WORKSPACE_WRITE,
    extraExecArgs = []
  } = {}) {
    const userArgs = this.executionPolicy ? this.executionPolicy.getExecutionArgs(context) : [];
    return this.runner('docker', [
      'compose', 'exec', '-T', ...userArgs, ...extraExecArgs, 'web', ...commandArgs
    ], { cwd: this.canvasDir });
  }
}
