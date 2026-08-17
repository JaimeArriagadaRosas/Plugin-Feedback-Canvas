import fs from 'node:fs';
import { getAssetsMarker } from '../utils/LocalWorkspacePaths.js';

import { createSpinner } from 'nanospinner';

import { analyzeLogAndDiagnose, printDiagnosisBox } from '../utils/Diagnostics.js';
import { runCommand } from '../utils/Runner.js';
import { CanvasLocalConfiguration } from './CanvasLocalConfiguration.js';
import { getCanvasResourceLimits } from './CanvasResourcePolicy.js';
import { GemCacheSecurity } from './GemCacheSecurity.js';
import { ExecutionContext } from '../../platform/shared/ContainerExecutionPolicy.js';

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
    this.dockerProfile = dockerProfile;
    this.configuration = configuration || new CanvasLocalConfiguration(boot, canvasDir, { dockerProfile: this.dockerProfile });
  }

  async setupAssets() {
    this._printHeader();
    const resourceLimits = await this._getResourceLimits();
    this.configuration.configure(resourceLimits);

    if (!(await this._prepareContainerWorkspace())) return false;

    for (const step of this._buildSteps()) {
      if (!(await this._runLogged(step))) return false;
    }

    fs.writeFileSync(getAssetsMarker(this.canvasDir), 'true');
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
      ...this._buildInfrastructureSteps(),
      ...this._buildDependencySteps(),
      ...this._buildCompilationSteps()
    ];
  }

  _buildInfrastructureSteps() {
    return [
      {
        command: ['docker', 'info'],
        context: ExecutionContext.NATIVE,
        startMessage: 'Verifying Docker daemon...',
        failureMessage: 'Docker is not responding.',
        successMessage: 'Docker is running'
      },
      {
        command: ['docker', 'compose', 'build', 'web', 'jobs'],
        context: ExecutionContext.NATIVE,
        startMessage: 'Building Docker images...',
        failureMessage: 'Could not build the images.',
        successMessage: 'Images built successfully'
      },
      {
        command: ['docker', 'compose', 'up', '-d', 'postgres', 'redis', 'web'],
        context: ExecutionContext.NATIVE,
        startMessage: 'Starting services in background...',
        failureMessage: 'Could not start background services.',
        successMessage: 'Services started'
      }
    ];
  }

  _buildDependencySteps() {
    return [
      {
        command: ['docker', 'compose', 'exec', '-T', 'web', 'bundle', 'plugin', 'install', 'bundler-multilock'],
        context: ExecutionContext.CONTAINER_CACHE_WRITE,
        startMessage: 'Installing Bundler plugin...',
        failureMessage: 'Error installing Bundler plugin.',
        successMessage: 'Bundler plugin installed',
        maxRetries: 5
      },
      {
        command: ['docker', 'compose', 'exec', '-T', 'web', 'bash', '-c', GemCacheSecurity.getNormalizationScript()],
        context: ExecutionContext.CONTAINER_CACHE_WRITE,
        startMessage: 'Normalizing gem permissions...',
        failureMessage: 'Failed to normalize gem cache.',
        successMessage: 'Gem cache permissions normalized'
      },
      {
        command: ['docker', 'compose', 'exec', '-T', '-e', 'BUNDLE_FROZEN=false', 'web', 'bash', '-c', 'umask 0022; exec bundle install --jobs=2'],
        context: ExecutionContext.WORKSPACE_WRITE,
        startMessage: 'Installing Ruby dependencies...',
        failureMessage: 'Error in Ruby.',
        successMessage: 'Ruby dependencies installed',
        maxRetries: 5
      },
      {
        command: ['docker', 'compose', 'exec', '-T', '-e', 'RAILS_ENV=development', 'web', 'bundle', 'exec', 'rake', 'db:create', 'db:migrate'],
        context: ExecutionContext.WORKSPACE_WRITE,
        startMessage: 'Initializing database...',
        failureMessage: 'Failed to initialize Canvas database.',
        successMessage: 'Database initialized'
      },
      {
        command: ['docker', 'compose', 'exec', '-T', 'web', 'yarn', 'install', '--frozen-lockfile', '--network-concurrency', '2', '--child-concurrency', '2'],
        context: ExecutionContext.WORKSPACE_WRITE,
        startMessage: 'Installing Yarn dependencies...',
        failureMessage: 'Error Yarn.',
        successMessage: 'Yarn dependencies installed',
        maxRetries: 5
      }
    ];
  }

  _buildCompilationSteps() {
    return [
      {
        command: ['docker', 'compose', 'exec', '-T', 'web', 'bash', '-c', "find bin script packages -type f \\( -name '*.sh' -o -path '*/scripts/*' \\) -print0 | xargs -0 -r sed -i 's/\\r$//'; find bin script -type f -print0 | xargs -0 -r sed -i 's/\\r$//'; true"],
        context: ExecutionContext.WORKSPACE_WRITE,
        startMessage: 'Normalizing CRLF...',
        failureMessage: 'Failed to normalize CRLF.',
        successMessage: 'CRLF normalized'
      },
      {
        command: ['docker', 'compose', 'exec', '-T', 'web', 'bundle', 'exec', 'rake', 'i18n:generate_js'],
        context: ExecutionContext.WORKSPACE_WRITE,
        startMessage: 'Copying translations (Brandable CSS)...',
        failureMessage: 'Failed to copy translations.',
        successMessage: 'Translations ready',
        maxRetries: 5
      },
      {
        command: ['docker', 'compose', 'exec', '-T', 'web', 'yarn', 'run', 'build:packages'],
        context: ExecutionContext.WORKSPACE_WRITE,
        startMessage: 'Installing Node packages (Yarn)...',
        failureMessage: 'Failed to install Node packages.',
        successMessage: 'Node packages installed',
        maxRetries: 5
      },
      {
        command: ['docker', 'compose', 'exec', '-T', '-e', 'CANVAS_BUILD_CONCURRENCY=1', '-e', 'PARALLEL_PROCESSORS=1', '-e', 'DISABLE_HAPPYPACK=1', '-e', 'NODE_OPTIONS=--max-old-space-size=2048', '-e', 'COMPILE_ASSETS_API_DOCS=0', '-e', 'COMPILE_ASSETS_BRAND_CONFIGS=0', 'web', 'bundle', 'exec', 'rake', 'canvas:compile_assets'],
        context: ExecutionContext.WORKSPACE_WRITE,
        startMessage: 'Installing Gems with Bundler...',
        failureMessage: 'Failed to install Gems.',
        successMessage: 'Gems installed',
        maxRetries: 10
      },
      {
        command: ['docker', 'compose', 'exec', '-T', 'web', 'bundle', 'exec', 'rake', 'brand_configs:write'],
        context: ExecutionContext.WORKSPACE_WRITE,
        startMessage: 'Generating brand configs...',
        failureMessage: 'Failed to generate brand configs.',
        successMessage: 'Brand configs generated'
      }
    ];
  }

  async _prepareContainerWorkspace() {
    const { ContainerExecutionPolicy } = await import('../../platform/shared/ContainerExecutionPolicy.js');
    this.executionPolicy = new ContainerExecutionPolicy(this.dockerProfile);
    return true;
  }

  async _getResourceLimits() {
    const result = await this.runner('docker', ['info', '--format', '{{.MemTotal}}'], { captureAll: true });
    const memoryBytes = Number.parseInt(result.success ? result.out?.trim() : '', 10);
    const limits = getCanvasResourceLimits(memoryBytes);
    if (limits.memoryGb !== null) {
      this.boot.info(`Canvas resources adjusted for ${limits.memoryGb.toFixed(1)}GB available.`);
    } else {
      this.boot.warn('Could not read Docker memory; applying conservative Canvas limits.');
    }
    return limits;
  }

  async _runLogged(step) {
    const { command, context = ExecutionContext.NATIVE, startMessage, failureMessage, successMessage, maxRetries = 0 } = step;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const spinner = createSpinner(attempt === 0 ? startMessage : `${startMessage} (Retry ${attempt}/${maxRetries})`).start();
      const args = this._applyContainerUser(command, context);
      const result = await this.runner(args[0], args.slice(1), {
        cwd: this.canvasDir,
        logFile: this.logFile,
        logMode: 'on-failure',
        onData: (output) => this._updateSpinner(spinner, startMessage, output)
      });
      if (result.success) {
        spinner.success({ text: successMessage, mark: '  √' });
        return true;
      }

      spinner.error({ text: `${this._getFailureMessage(failureMessage, result)} Code ${result.code}`, mark: '  ×' });
      if (this._isNonRetryableError(result.out + '\n' + result.err)) {
        break;
      }
      if (attempt < maxRetries) await this._waitForRetry(attempt + 1);
    }
    this._printDiagnosis();
    return false;
  }

  _isNonRetryableError(output) {
    const nonRetryablePatterns = [
      /INSECURE_UNFIXABLE:/i,
      /INSECURE_REMAINING:/i,
      /INSECURE_CHMOD_FAILED:/i,
      /INSECURE_SCAN_FAILED:/i,
      /world-writable and does not have the sticky bit set/i,
      /unsafe to remove/i
    ];
    return nonRetryablePatterns.some((pattern) => pattern.test(output));
  }

  _applyContainerUser(commandArgs, context) {
    const execIndex = commandArgs.indexOf('exec');
    if (execIndex < 0 || commandArgs.includes('--user')) {
      return commandArgs;
    }
    const injectedArgs = this.executionPolicy.getExecutionArgs(context);
    if (injectedArgs.length === 0) return commandArgs;

    return [
      ...commandArgs.slice(0, execIndex + 2),
      ...injectedArgs,
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
