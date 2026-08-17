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
    this.boot.warn('Directorio de Canvas LMS no encontrado. Invocando recuperación automática...');
    const marker = path.join(this.pluginDir, '.setup_complete');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (fs.existsSync(marker)) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.unlinkSync(marker);
      this.boot.info('Archivo .setup_complete eliminado (Fast Boot abortado).');
    }
    process.env.FAST_BOOT = 'false';
  }

  async _runFastBoot(dockerProfile) {
    this.boot.info('Modo Fast Boot detectado: verificando runtime y contenedores...');
    const installer = this._createDockerInstaller();
    if (!dockerProfile.daemonAvailable) {
      if (!(await installer.handleDockerDaemonDown(dockerProfile))) {
        throw new Error('Docker no está disponible. Corrija la acción indicada y reanude npm start.');
      }
      dockerProfile = await installer.getRuntimeState();
    }

    this._ensureLogsDirectory();
    const preflight = new PreflightChecks(this.boot, this.canvasDir, this.pluginDir, { dockerState: dockerProfile });
    const { allOk, missing } = await preflight.runChecks();

    if (!allOk) {
      this.boot.warn('Componentes estáticos faltantes o detenidos. Recuperando...');
      dockerProfile = await this._provisionMissing(missing, dockerProfile);
      await this._verifyPostInstall();
    }

    await this._bringupAndVerify(dockerProfile);

    this.boot.info('Contenedores activos. Fast Boot completado exitosamente.');
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
      this.boot.error('Docker parece estar instalado, pero su CLI no es utilizable desde este entorno.');
      this.boot.action(guidance.action);
      throw new Error(guidance.fix);
    }

    const details = installer.getInstallDetails();
    this.boot.warn(installer.policy.missing(state).message);
    this.boot.info(`Destino de instalación: ${details.target}.`);
    if (!(await this.confirm(details.prompt))) {
      this.boot.action(details.declined);
      throw new Error('Instalación de Docker cancelada por el usuario.');
    }
    if (!(await installer.installDocker())) throw new Error('Fallo en la instalación automática de Docker.');

    const installedState = await installer.getRuntimeState();
    if (!installedState.daemonAvailable && !(await installer.handleDockerDaemonDown(installedState))) {
      throw new Error('Docker fue instalado, pero requiere aplicar permisos o reiniciar la sesión antes de continuar.');
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
      throw new Error(`No se pudo conectar al daemon remoto configurado en DOCKER_HOST (${process.env.DOCKER_HOST}).`);
    }
    if (!(await installer.handleDockerDaemonDown(state))) {
      throw new Error('Docker no está disponible; aplique la corrección indicada y reanude el setup.');
    }
  }

  async _ensureCompose(missing, dockerProfile) {
    if (!missing.missing_compose) return;
    const installer = this._createDockerInstaller();
    const state = dockerProfile;
    missing.docker_state = state;
    if (state.composeAvailable) {
      missing.missing_compose = false;
      this.boot.success('Docker Compose V2 disponible.');
      return;
    }
    this.boot.error('La CLI existe, pero Docker Compose V2 no está disponible.');
    this.boot.action(installer.policy.compose(state));
    throw new Error('Docker Compose V2 es obligatorio para el entorno local.');
  }

  async _ensureCanvasFiles(missing, dockerProfile) {
    if (missing.missing_canvas_clone) {
      const cloner = new CanvasCloner(this.boot, this.logFile, this.canvasDir);
      if (!(await cloner.cloneCanvas())) throw new Error('Fallo durante el clonado de Canvas LMS.');
      missing.missing_canvas_assets = true;
    }
    if (missing.missing_canvas_assets) {
      const builder = new AssetBuilder(this.boot, this.logFile, this.canvasDir, { dockerProfile });
      if (!(await builder.setupAssets())) throw new Error('Fallo al preparar Canvas LMS. Revisa el diagnóstico mostrado antes de reintentar.');
    }
  }

  async _ensurePluginDatabase(missing) {
    const dbStatus = missing.plugin_db_status;
    const gStatus = missing.gotenberg_status;

    if (!dbStatus && !gStatus) return; // both healthy

    const needsRecovery = (dbStatus && dbStatus !== 'starting') || (gStatus && gStatus !== 'starting');

    if (needsRecovery) {
      this.boot.info('Dependencias missing/unhealthy. Intentando recuperación...');
      const toRecover = [];
      if (dbStatus && dbStatus !== 'starting') toRecover.push('db');
      if (gStatus && gStatus !== 'starting') toRecover.push('gotenberg');

      try {
        await execa('docker', ['compose', '-f', 'docker-compose.db.yml', 'rm', '-s', '-f', ...toRecover], { cwd: this.pluginDir });
      } catch { }
    } else {
      this.boot.info('Dependencias en estado starting. Esperando healthcheck...');
    }

    try {
      await execa('docker', ['compose', '-f', 'docker-compose.db.yml', 'up', '-d', '--wait'], { cwd: this.pluginDir });
      if (dbStatus && dbStatus !== 'starting') {
        const { runMigrations } = await import('@plugin-feedback/plugin-database');
        await runMigrations();
      }
    } catch (error) {
      throw new Error(`Fallo al inicializar las dependencias locales: ${error.message}`);
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
    this.boot.info('Ejecutando verificación post-instalación...');
    const result = await new PreflightChecks(this.boot, this.canvasDir, this.pluginDir).runChecks();
    if (!result.allOk) throw new Error('Verificación post-instalación fallida; aún faltan componentes.');
  }

  async _bringupAndVerify(dockerProfile) {
    const bringup = new CanvasBringup(this.boot, this.canvasDir, { dockerProfile });
    if (!(await bringup.bringup())) throw new Error('Fallo en el bringup de Canvas LMS.');
    const postflight = new PostflightSetup(this.boot, this.pluginDir, this.canvasDir);
    if (!(await postflight.runChecks())) throw new Error('Fallo en la verificación post-arranque.');
  }

  async ensureSetup() {
    this._recoverInvalidFastBoot();
    
    // Obtener el perfil Docker una única vez para toda la orquestación
    const installer = this._createDockerInstaller();
    let dockerProfile = await installer.getRuntimeState();

    if (process.env.FAST_BOOT === 'true') return this._runFastBoot(dockerProfile);

    this.boot.info('Iniciando verificación del entorno local de Canvas LMS.');
    this._ensureLogsDirectory();
    const preflight = new PreflightChecks(this.boot, this.canvasDir, this.pluginDir, { dockerState: dockerProfile });
    const { allOk, missing } = await preflight.runChecks();
    if (!allOk) {
      this.boot.warn('Componentes faltantes detectados. Iniciando setup reanudable...');
      dockerProfile = await this._provisionMissing(missing, dockerProfile);
      await this._verifyPostInstall();
    }

    this.boot.success('Todos los componentes requeridos están instalados.');
    await this._bringupAndVerify(dockerProfile);
    this.boot.info('Verificación de entorno completada exitosamente.');
    return true;
  }
}
