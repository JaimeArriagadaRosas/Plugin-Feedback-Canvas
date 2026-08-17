import fs from 'node:fs';
import path from 'node:path';
import { execa } from 'execa';
import { PreflightChecks } from './PreflightChecks.js';
import { DockerInstaller } from './installers/DockerInstaller.js';
import { CanvasCloner } from './installers/CanvasCloner.js';
import { AssetBuilder } from './installers/AssetBuilder.js';
import { CanvasBringup } from './CanvasBringup.js';
import { PostflightSetup } from './PostflightSetup.js';
import { askConfirm } from '../orchestration/cli.js';

export class EnvironmentSetup {
  constructor(boot, pluginDir, canvasDir, {
    confirm = askConfirm,
    dockerInstallerFactory = (logger, logFile) => new DockerInstaller(logger, logFile)
  } = {}) {
    this.boot = boot;
    this.pluginDir = pluginDir;
    this.canvasDir = canvasDir;
    this.confirm = confirm;
    this.dockerInstallerFactory = dockerInstallerFactory;
    this.logFile = path.join(this.pluginDir, 'logs', 'canvas_build.log');
  }

  _createDockerInstaller() {
    return this.dockerInstallerFactory(this.boot, this.logFile);
  }

  _recoverInvalidFastBoot() {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (process.env.FAST_BOOT !== 'true' || fs.existsSync(this.canvasDir)) return;
    this.boot.warn('Canvas LMS directory not found. Invoking automatic recovery...');
    const marker = path.join(this.pluginDir, '.setup_complete');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (fs.existsSync(marker)) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.unlinkSync(marker);
      this.boot.info('.setup_complete file deleted (Fast Boot aborted).');
    }
    process.env.FAST_BOOT = 'false';
  }

  async _runFastBoot(dockerProfile) {
    this.boot.info('Fast Boot mode detected: verifying runtime and containers...');
    const installer = this._createDockerInstaller();
    if (!dockerProfile.daemonAvailable) {
      if (!(await installer.handleDockerDaemonDown(dockerProfile))) {
        throw new Error('Docker is not available. Fix the indicated action and resume npm start.');
      }
      dockerProfile = await installer.getRuntimeState();
    }

    this._ensureLogsDirectory();
    const preflight = new PreflightChecks(this.boot, this.canvasDir, this.pluginDir, { dockerState: dockerProfile });
    const { allOk, missing } = await preflight.runChecks();

    if (!allOk) {
      this.boot.warn('Missing or stopped static components. Recovering...');
      dockerProfile = await this._provisionMissing(missing, dockerProfile);
      await this._verifyPostInstall();
    }

    await this._bringupAndVerify(dockerProfile);

    this.boot.info('Containers active. Fast Boot completed successfully.');
    return true;
  }

  _ensureLogsDirectory() {
    const logsDir = path.dirname(this.logFile);
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  }

  async _installMissingDocker(installer, state) {
    const physical = await installer.isDockerInstalled();
    if (physical) {
      const guidance = installer.policy.missing(state);
      this.boot.error('Docker appears to be installed, but its CLI is not usable from this environment.');
      this.boot.action(guidance.action);
      throw new Error(guidance.fix);
    }

    const details = installer.getInstallDetails();
    this.boot.warn(installer.policy.missing(state).message);
    this.boot.info(`Installation target: ${details.target}.`);
    if (!(await this.confirm(details.prompt))) {
      this.boot.action(details.declined);
      throw new Error('Docker installation canceled by the user.');
    }
    if (!(await installer.installDocker())) throw new Error('Automatic Docker installation failed.');

    const installedState = await installer.getRuntimeState();
    if (!installedState.daemonAvailable && !(await installer.handleDockerDaemonDown(installedState))) {
      throw new Error('Docker was installed, but requires applying permissions or restarting the session before continuing.');
    }
  }

  async _ensureDocker(missing, dockerProfile) {
    if (!missing.missing_docker && !missing.docker_daemon_down && !missing.docker_permission_denied) return;
    const installer = this._createDockerInstaller();
    const state = missing.docker_state || dockerProfile;

    if (missing.missing_docker) {
      await this._installMissingDocker(installer, state);
      return;
    }
    if (state.cliOrigin === 'remote') {
      throw new Error(`Could not connect to the remote daemon configured in DOCKER_HOST (${process.env.DOCKER_HOST}).`);
    }
    if (!(await installer.handleDockerDaemonDown(state))) {
      throw new Error('Docker is not available; apply the indicated fix and resume the setup.');
    }
  }

  async _ensureCompose(missing, dockerProfile) {
    if (!missing.missing_compose) return;
    const installer = this._createDockerInstaller();
    const state = dockerProfile;
    missing.docker_state = state;
    if (state.composeAvailable) {
      missing.missing_compose = false;
      this.boot.success('Docker Compose V2 available.');
      return;
    }
    this.boot.error('The CLI exists, but Docker Compose V2 is not available.');
    this.boot.action(installer.policy.compose(state));
    throw new Error('Docker Compose V2 is required for the local environment.');
  }

  async _ensureCanvasFiles(missing, dockerProfile) {
    if (missing.missing_canvas_clone) {
      const cloner = new CanvasCloner(this.boot, this.logFile, this.canvasDir);
      if (!(await cloner.cloneCanvas())) throw new Error('Failed during Canvas LMS cloning.');
      missing.missing_canvas_assets = true;
    }
    if (missing.missing_canvas_assets) {
      const builder = new AssetBuilder(this.boot, this.logFile, this.canvasDir, { dockerProfile });
      if (!(await builder.setupAssets())) throw new Error('Failed to prepare Canvas LMS. Check the displayed diagnostics before retrying.');
    }
  }

  async _ensurePluginDatabase(missing) {
    const dbStatus = missing.plugin_db_status;
    const gStatus = missing.gotenberg_status;

    if (!dbStatus && !gStatus) return; // both healthy

    const needsRecovery = (dbStatus && dbStatus !== 'starting') || (gStatus && gStatus !== 'starting');

    if (needsRecovery) {
      this.boot.info('Dependencies missing/unhealthy. Attempting recovery...');
      const toRecover = [];
      if (dbStatus && dbStatus !== 'starting') toRecover.push('db');
      if (gStatus && gStatus !== 'starting') toRecover.push('gotenberg');

      try {
        await execa('docker', ['compose', '-f', 'docker-compose.db.yml', 'rm', '-s', '-f', ...toRecover], { cwd: this.pluginDir });
      } catch { }
    } else {
      this.boot.info('Dependencies in starting state. Waiting for healthcheck...');
    }

    try {
      await execa('docker', ['compose', '-f', 'docker-compose.db.yml', 'up', '-d', '--wait'], { cwd: this.pluginDir });
      if (dbStatus && dbStatus !== 'starting') {
        const { runMigrations } = await import('@plugin-feedback/plugin-database');
        await runMigrations();
      }
    } catch (error) {
      throw new Error(`Failed to initialize local dependencies: ${error.message}`);
    }
  }

  async _provisionMissing(missing, dockerProfile) {
    await this._ensureDocker(missing, dockerProfile);

    const installer = this._createDockerInstaller();
    const updatedProfile = await installer.getRuntimeState();

    await this._ensureCompose(missing, updatedProfile);
    await this._ensureCanvasFiles(missing, updatedProfile);
    await this._ensurePluginDatabase(missing);

    return updatedProfile;
  }

  async _verifyPostInstall() {
    this.boot.info('Running post-installation verification...');
    const result = await new PreflightChecks(this.boot, this.canvasDir, this.pluginDir).runChecks();
    if (!result.allOk) throw new Error('Post-installation verification failed; components are still missing.');
  }

  async _bringupAndVerify(dockerProfile) {
    const bringup = new CanvasBringup(this.boot, this.canvasDir, { dockerProfile });
    if (!(await bringup.bringup())) throw new Error('Canvas LMS bringup failed.');
    const postflight = new PostflightSetup(this.boot, this.pluginDir, this.canvasDir);
    if (!(await postflight.runChecks())) throw new Error('Post-startup verification failed.');
  }

  async ensureSetup() {
    this._recoverInvalidFastBoot();

    // Get the Docker profile only once for the entire orchestration
    const installer = this._createDockerInstaller();
    let dockerProfile = await installer.getRuntimeState();

    if (process.env.FAST_BOOT === 'true') return this._runFastBoot(dockerProfile);

    this.boot.info('Starting verification of the Canvas LMS local environment.');
    this._ensureLogsDirectory();
    const preflight = new PreflightChecks(this.boot, this.canvasDir, this.pluginDir, { dockerState: dockerProfile });
    const { allOk, missing } = await preflight.runChecks();
    if (!allOk) {
      this.boot.warn('Missing components detected. Starting resumable setup...');
      dockerProfile = await this._provisionMissing(missing, dockerProfile);
      await this._verifyPostInstall();
    }

    this.boot.success('All required components are installed.');
    await this._bringupAndVerify(dockerProfile);
    this.boot.info('Environment verification completed successfully.');
    return true;
  }
}
