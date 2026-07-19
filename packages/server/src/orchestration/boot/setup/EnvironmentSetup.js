import fs from 'node:fs';
import path from 'node:path';
import { PreflightChecks } from './PreflightChecks.js';
import { DockerInstaller } from './installers/DockerInstaller.js';
import { CanvasCloner } from './installers/CanvasCloner.js';
import { AssetBuilder } from './installers/AssetBuilder.js';
import { CanvasBringup } from './CanvasBringup.js';
import { PostflightSetup } from './PostflightSetup.js';

export class EnvironmentSetup {
  constructor(boot, pluginDir, canvasDir) {
    this.boot = boot;
    this.pluginDir = pluginDir;
    this.canvasDir = canvasDir;
    this.logFile = path.join(this.pluginDir, 'logs', 'canvas_build.log');
  }

  async ensureSetup() {
    this.boot.info('Iniciando verificación de entorno para Canvas LMS local (Node.js Native Installer)');
    
    const logsDir = path.dirname(this.logFile);
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

    const preflight = new PreflightChecks(this.boot, this.canvasDir);
    const { allOk, missing } = await preflight.runChecks();

    if (!allOk) {
      this.boot.warn('Componentes faltantes detectados. Iniciando instalación automática...');
      
      // Auto Installer Logic
      if (missing.missing_docker || missing.docker_daemon_down) {
        const dockerInstaller = new DockerInstaller(this.boot, this.logFile);
        if (missing.missing_docker) {
          if (!(await dockerInstaller.installDocker())) throw new Error('Fallo en la instalación automática de Docker');
        } else if (missing.docker_daemon_down) {
          if (!(await dockerInstaller.handleDockerDaemonDown())) throw new Error('Fallo al intentar arrancar el demonio de Docker');
        }
      }

      if (missing.missing_canvas_clone) {
        const cloner = new CanvasCloner(this.boot, this.logFile, this.canvasDir);
        if (!(await cloner.cloneCanvas())) throw new Error('Fallo al clonar el repositorio de Canvas LMS');
        missing.missing_canvas_assets = true; // Auto require assets if just cloned
      }

      if (missing.missing_canvas_assets) {
        const builder = new AssetBuilder(this.boot, this.logFile, this.canvasDir);
        if (!(await builder.setupAssets())) throw new Error('Fallo al inicializar los assets de Canvas');
      }
      
      this.boot.plain('');
      this.boot.plain('=========================================================');
      this.boot.plain('   VERIFICACION POST-INSTALACION');
      this.boot.plain('=========================================================');
      const postInstall = await preflight.runChecks();
      if (!postInstall.allOk) {
        this.boot.error('Verificación post-instalación fallida. Aún faltan componentes.');
        throw new Error('Verificación post-instalación fallida');
      }
    }

    this.boot.plain('');
    this.boot.plain('=========================================================');
    this.boot.plain('   TODOS LOS COMPONENTES ESTAN CORRECTAMENTE INSTALADOS');
    this.boot.plain('=========================================================');

    const bringup = new CanvasBringup(this.boot, this.canvasDir);
    if (!(await bringup.bringup())) {
      this.boot.error('Fallo en el bringup de Canvas LMS');
      throw new Error('Fallo en el bringup de Canvas LMS');
    }

    const postflight = new PostflightSetup(this.boot, this.pluginDir, this.canvasDir);
    if (!(await postflight.runChecks())) {
      this.boot.error('Fallo en la verificación post-arranque');
      throw new Error('Fallo en la verificación post-arranque');
    }

    this.boot.info('Verificación de entorno completada exitosamente.');
    return true;
  }
}
