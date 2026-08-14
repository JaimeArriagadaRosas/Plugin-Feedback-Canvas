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
    containerWorkspacePermissions
  } = {}) {
    this.boot = boot;
    this.logFile = logFile;
    this.canvasDir = canvasDir;
    this.runner = runner;
    this.configuration = configuration || new CanvasLocalConfiguration(boot, canvasDir);
    this.containerWorkspacePermissions = containerWorkspacePermissions ||
      createContainerWorkspacePermissions(platform, { runner });
    this.containerExecArgs = [];
  }

  async setupAssets() {
    this._printHeader();
    const resourceLimits = await this._getResourceLimits();
    this.configuration.configure(resourceLimits);

    await this.runner('docker', ['compose', 'up', '-d', 'postgres', 'redis'], { cwd: this.canvasDir });
    await this.runner('docker', ['compose', 'up', '-d', '--force-recreate', 'web'], { cwd: this.canvasDir });
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
    this.boot.plain('   CONFIGURING CANVAS LMS DEPENDENCIES AND ASSETS');
    this.boot.plain('=========================================================');
  }

  _buildSteps() {
    return [
      [['docker', 'info'], 'Verifying Docker daemon...', 'Docker is not responding.', 'Docker is running'],
      [['docker', 'compose', 'up', '-d', 'postgres', 'redis', 'web'], 'Starting containers...', 'Start failed.', 'Containers started'],
      [['docker', 'compose', 'exec', '-T', 'web', 'chmod', '-R', 'go-w', '/home/docker/.gem'],
      'Ensuring gem cache permissions...', 'Failed to ensure gem cache permissions.', 'Gem cache permissions ensured'],
      [['docker', 'compose', 'exec', '-T', 'web', 'bundle', 'plugin', 'install', 'bundler-multilock'],
      'Installing Bundler plugin...', 'Error installing Bundler plugin.', 'Bundler plugin installed', 5],
      [['docker', 'compose', 'exec', '-T', '-e', 'BUNDLE_FROZEN=false', 'web',
        'bundle', 'install', '--jobs=2'],
      'Installing Ruby dependencies...', 'Ruby error.', 'Ruby dependencies installed', 5],
      [['docker', 'compose', 'exec', '-T', '-e', 'RAILS_ENV=development', 'web', 'bundle', 'exec',
        'rake', 'db:create', 'db:migrate'],
      'Initializing database...', 'Failed to initialize the Canvas database.', 'Database initialized'],
      [['docker', 'compose', 'exec', '-T', 'web', 'yarn', 'install', '--frozen-lockfile',
        '--network-concurrency', '2', '--child-concurrency', '2'],
      'Installing Yarn dependencies...', 'Yarn error.', 'Yarn dependencies installed', 5],
      [['docker', 'compose', 'exec', '-T', 'web', 'bash', '-c',
        "find bin script packages -type f \\( -name '*.sh' -o -path '*/scripts/*' \\) -print0 | xargs -0 -r sed -i 's/\\r$//'; find bin script -type f -print0 | xargs -0 -r sed -i 's/\\r$//'; true"],
      'Normalizing CRLF...', 'Failed to normalize CRLF.', 'CRLF normalized'],
      [['docker', 'compose', 'exec', '-T', 'web', 'bundle', 'exec', 'rake', 'i18n:generate_js'],
      'Generating translations...', 'i18n:generate_js failed.', 'Translations generated', 5],
      [['docker', 'compose', 'exec', '-T', 'web', 'yarn', 'run', 'build:packages'],
      'Building internal packages...', 'build:packages failed.', 'Packages built', 5],
      [['docker', 'compose', 'exec', '-T', '-e', 'CANVAS_BUILD_CONCURRENCY=1', '-e',
        'PARALLEL_PROCESSORS=1', '-e', 'DISABLE_HAPPYPACK=1', '-e', 'NODE_OPTIONS=--max-old-space-size=2048',
        '-e', 'COMPILE_ASSETS_API_DOCS=0', '-e', 'COMPILE_ASSETS_BRAND_CONFIGS=0', 'web', 'bundle', 'exec',
        'rake', 'canvas:compile_assets'],
      'Compiling assets...', 'Asset compilation failed.', 'Assets compiled successfully', 10],
      [['docker', 'compose', 'exec', '-T', 'web', 'bundle', 'exec', 'rake', 'brand_configs:write'],
      'Generating brand configs...', 'Failed to generate brand configs.', 'Brand configs generated']
    ];
  }

  async _prepareContainerWorkspace() {
    const args = await this.containerWorkspacePermissions.prepare({
      canvasDir: this.canvasDir,
      logFile: this.logFile,
      boot: this.boot
    });
    if (args === null) return false;
    this.containerExecArgs = args;
    return true;
  }

  async _getResourceLimits() {
    const result = await this.runner('docker', ['info', '--format', '{{.MemTotal}}'], { captureAll: true });
    const memoryBytes = Number.parseInt(result.success ? result.out?.trim() : '', 10);
    const limits = getCanvasResourceLimits(memoryBytes);
    if (limits.memoryGb !== null) {
      this.boot.info(`Canvas resources adjusted for ${limits.memoryGb.toFixed(1)}GB available.`);
    } else {
      this.boot.warn('Could not read Docker memory; conservative Canvas limits will be applied.');
    }
    return limits;
  }

  async _runLogged(commandArgs, startMsg, failMsg, successMsg, maxRetries = 0) {
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const spinner = createSpinner(attempt === 0 ? startMsg : `${startMsg} (Retry ${attempt}/${maxRetries})`).start();
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

      spinner.error({ text: `${this._getFailureMessage(failMsg, result)} Code ${result.code}`, mark: '  ×' });
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
      return 'Canvas encryption key does not match the existing database.';
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
    else this.boot.error(`Failure without diagnosis. Check log: ${this.logFile}`);
  }
}
