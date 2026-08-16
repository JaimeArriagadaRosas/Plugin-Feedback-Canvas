import fs from 'node:fs';
import path from 'node:path';

import { createSpinner } from 'nanospinner';

import { analyzeLogAndDiagnose, printDiagnosisBox } from '../utils/Diagnostics.js';
import { runCommand } from '../utils/Runner.js';
import { CanvasLocalConfiguration } from './CanvasLocalConfiguration.js';
import { getCanvasResourceLimits } from './CanvasResourcePolicy.js';
import { createContainerWorkspacePermissions } from '../../platform/shared/ContainerWorkspacePermissionsFactory.js';

export class AssetBuilder {
  constructor(boot, logFile, canvasDir, {
    runner = runCommand,
    configuration,
    platform = process.platform,
    dockerProfile = null
  } = {}) {
    this.boot = boot;
    this.logFile = logFile;
    this.canvasDir = canvasDir;
    this.runner = runner;
    this.configuration = configuration || new CanvasLocalConfiguration(boot, canvasDir);
    this.dockerProfile = dockerProfile;
    this.containerExecArgs = [];
  }

  async setupAssets() {
    this._printHeader();
    const resourceLimits = await this._getResourceLimits();
    this.configuration.configure(resourceLimits);

    if (!(await this._prepareContainerWorkspace())) return false;

    for (const step of this._buildSteps()) {
      if (!(await this._runLogged(...step))) return false;
    }

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.writeFileSync(path.join(this.canvasDir, '.assets_built'), 'true');
    return true;
  }

  _printHeader() {
    this.boot.plain('');
    this.boot.plain('=========================================================');
    this.boot.plain('   CONFIGURANDO DEPENDENCIAS Y ASSETS DE CANVAS LMS');
    this.boot.plain('=========================================================');
  }

  _buildSteps() {
    return [
      [['docker', 'info'], 'Verificando daemon Docker...', 'Docker no responde.', 'Docker en ejecucion'],
      [['docker', 'compose', 'build', 'web', 'jobs'], 'Construyendo imagenes Docker...', 'Fallo al construir imagenes.', 'Imagenes Docker construidas'],
      [['docker', 'compose', 'up', '-d', 'postgres', 'redis', 'web'], 'Iniciando contenedores...', 'Fallo el inicio.', 'Contenedores iniciados'],
      [['docker', 'compose', 'exec', '-T', 'web', 'chmod', '-R', 'go-w', '/home/docker/.gem'],
      'Asegurando permisos del cache de gems...', 'Fallo al asegurar permisos del cache de gems.', 'Permisos del cache de gems asegurados'],
      [['docker', 'compose', 'exec', '-T', 'web', 'bundle', 'plugin', 'install', 'bundler-multilock'],
      'Instalando plugin de Bundler...', 'Error instalando plugin de Bundler.', 'Plugin de Bundler instalado', 5],
      [['docker', 'compose', 'exec', '-T', '-e', 'BUNDLE_FROZEN=false', 'web',
        'bundle', 'install', '--jobs=2'],
      'Instalando dependencias de Ruby...', 'Error en Ruby.', 'Dependencias de Ruby instaladas', 5],
      [['docker', 'compose', 'exec', '-T', '-e', 'RAILS_ENV=development', 'web', 'bundle', 'exec',
        'rake', 'db:create', 'db:migrate'],
      'Inicializando base de datos...', 'Fallo al inicializar la base de datos de Canvas.', 'Base de datos inicializada'],
      [['docker', 'compose', 'exec', '-T', 'web', 'yarn', 'install', '--frozen-lockfile',
        '--network-concurrency', '2', '--child-concurrency', '2'],
      'Instalando dependencias Yarn...', 'Error Yarn.', 'Dependencias de Yarn instaladas', 5],
      [['docker', 'compose', 'exec', '-T', 'web', 'bash', '-c',
        "find bin script packages -type f \\( -name '*.sh' -o -path '*/scripts/*' \\) -print0 | xargs -0 -r sed -i 's/\\r$//'; find bin script -type f -print0 | xargs -0 -r sed -i 's/\\r$//'; true"],
      'Normalizando CRLF...', 'Fallo al normalizar CRLF.', 'CRLF normalizado'],
      [['docker', 'compose', 'exec', '-T', 'web', 'bundle', 'exec', 'rake', 'i18n:generate_js'],
      'Generando traducciones...', 'Fallo en i18n:generate_js.', 'Traducciones generadas', 5],
      [['docker', 'compose', 'exec', '-T', 'web', 'yarn', 'run', 'build:packages'],
      'Construyendo paquetes internos...', 'Fallo en build:packages.', 'Paquetes construidos', 5],
      [['docker', 'compose', 'exec', '-T', '-e', 'CANVAS_BUILD_CONCURRENCY=1', '-e',
        'PARALLEL_PROCESSORS=1', '-e', 'DISABLE_HAPPYPACK=1', '-e', 'NODE_OPTIONS=--max-old-space-size=2048',
        '-e', 'COMPILE_ASSETS_API_DOCS=0', '-e', 'COMPILE_ASSETS_BRAND_CONFIGS=0', 'web', 'bundle', 'exec',
        'rake', 'canvas:compile_assets'],
      'Compilando assets...', 'Fallo la compilacion de assets.', 'Assets compilados exitosamente', 10],
      [['docker', 'compose', 'exec', '-T', 'web', 'bundle', 'exec', 'rake', 'brand_configs:write'],
      'Generando brand configs...', 'Fallo al generar brand configs.', 'Brand configs generados']
    ];
  }

  async _prepareContainerWorkspace() {
    const { ContainerExecutionPolicy } = await import('../../platform/shared/ContainerExecutionPolicy.js');
    this.executionPolicy = new ContainerExecutionPolicy(this.dockerProfile);
    this.containerExecArgs = this.executionPolicy.getExecutionArgs();
    return true;
  }

  async _getResourceLimits() {
    const result = await this.runner('docker', ['info', '--format', '{{.MemTotal}}'], { captureAll: true });
    const memoryBytes = Number.parseInt(result.success ? result.out?.trim() : '', 10);
    const limits = getCanvasResourceLimits(memoryBytes);
    if (limits.memoryGb !== null) {
      this.boot.info(`Recursos Canvas ajustados para ${limits.memoryGb.toFixed(1)}GB disponibles.`);
    } else {
      this.boot.warn('No se pudo leer la memoria de Docker; se aplicaran limites conservadores de Canvas.');
    }
    return limits;
  }

  async _runLogged(commandArgs, startMsg, failMsg, successMsg, maxRetries = 0) {
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const spinner = createSpinner(attempt === 0 ? startMsg : `${startMsg} (Reintento ${attempt}/${maxRetries})`).start();
      const args = this._applyContainerUser(commandArgs);
      const result = await this.runner(args[0], args.slice(1), {
        cwd: this.canvasDir,
        logFile: this.logFile,
        logMode: 'on-failure',
        onData: (output) => this._updateSpinner(spinner, startMsg, output)
      });
      if (result.success) {
        spinner.success({ text: successMsg, mark: '  √' });
        return true;
      }

      spinner.error({ text: `${this._getFailureMessage(failMsg, result)} Código ${result.code}`, mark: '  ×' });
      if (attempt < maxRetries) await this._waitForRetry(attempt + 1);
    }
    this._printDiagnosis();
    return false;
  }

  _applyContainerUser(commandArgs) {
    const execIndex = commandArgs.indexOf('exec');
    if (execIndex < 0 || this.containerExecArgs.length === 0 || commandArgs.includes('--user') ||
      commandArgs.includes('plugin')) return commandArgs;
    return [
      ...commandArgs.slice(0, execIndex + 2),
      ...this.containerExecArgs,
      ...commandArgs.slice(execIndex + 2)
    ];
  }

  _updateSpinner(spinner, startMsg, output) {
    const lastLine = output.trim().split('\n').at(-1)?.trim();
    if (!lastLine) return;
    const displayed = lastLine.length < 60 ? lastLine : `${lastLine.substring(0, 57)}...`;
    spinner.update({ text: `${startMsg} > ${displayed}` });
  }

  _getFailureMessage(defaultMessage, result) {
    const output = `${result.out}\n${result.err}`;
    if (/encryption key is incorrect/i.test(output)) {
      return 'Clave de cifrado de Canvas no coincide con la base de datos existente.';
    }
    return defaultMessage;
  }

  async _waitForRetry(attempt) {
    const backoff = Math.min(2 ** attempt * 1000, 15000);
    await new Promise((resolve) => setTimeout(resolve, backoff));
  }

  _printDiagnosis() {
    const diagnosis = analyzeLogAndDiagnose(this.logFile);
    if (diagnosis) printDiagnosisBox(this.boot, diagnosis);
    else this.boot.error(`Fallo sin diagnostico. Revisar log: ${this.logFile}`);
  }
}
