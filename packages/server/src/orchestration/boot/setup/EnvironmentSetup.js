import fs from 'node:fs';
import path from 'node:path';
import { execa } from 'execa';
import { PreflightChecks } from './PreflightChecks.js';
import { DockerInstaller } from './installers/DockerInstaller.js';
import { CanvasCloner } from './installers/CanvasCloner.js';
import { AssetBuilder } from './installers/AssetBuilder.js';
import { CanvasBringup } from './CanvasBringup.js';
import { PostflightSetup } from './PostflightSetup.js';
import { askConfirm } from '../../cli.js';

export class EnvironmentSetup {
  constructor(boot, pluginDir, canvasDir) {
    this.boot = boot;
    this.pluginDir = pluginDir;
    this.canvasDir = canvasDir;
    this.logFile = path.join(this.pluginDir, 'logs', 'canvas_build.log');
  }

  async ensureSetup() {
    if (process.env.FAST_BOOT === 'true' && !fs.existsSync(this.canvasDir)) {
      this.boot.warn('Directorio de Canvas LMS no encontrado. Invocando recuperación automática...');
      const setupCompletePath = path.join(this.pluginDir, '.setup_complete');
      if (fs.existsSync(setupCompletePath)) {
        fs.unlinkSync(setupCompletePath);
        this.boot.info('Archivo .setup_complete eliminado (Fast Boot abortado).');
      }
      process.env.FAST_BOOT = 'false';
    }

    if (process.env.FAST_BOOT === 'true') {
      this.boot.info('Modo Fast Boot detectado: Saltando orquestación pesada...');
      
      const dockerInstaller = new DockerInstaller(this.boot, this.logFile);
      if (!(await dockerInstaller.isDockerDaemonRunning())) {
        this.boot.warn('Demonio de Docker no disponible al iniciar Fast Boot.');
        if (!(await dockerInstaller.handleDockerDaemonDown())) {
          this.boot.error('No se pudo establecer conexión con Docker en el tiempo límite.');
          this.boot.error('Por favor, verifique Docker Desktop y vuelva a ejecutar npm start.');
          process.exit(1);
        }
      }

      this.boot.info('Asegurando contenedores de Canvas LMS en segundo plano...');
      const bringup = new CanvasBringup(this.boot, this.canvasDir);
      if (!(await bringup.startStack())) {
        this.boot.error('No se pudieron iniciar los contenedores de Canvas LMS con Docker Compose.');
        this.boot.error('El archivo .setup_complete se ha conservado para reintentar el arranque rápido tras solucionar el problema en Docker.');
        process.exit(1);
      }
      
      if (!(await bringup.waitForReady())) {
        this.boot.error('Los contenedores de Canvas LMS tardaron demasiado o fallaron al reportarse operativos.');
        this.boot.error('El archivo .setup_complete se ha conservado para reintentar el arranque rápido tras solucionar el problema.');
        process.exit(1);
      }
      
      this.boot.info('Contenedores activos. Fast Boot completado exitosamente.');
      return true;
    }

    this.boot.info('Iniciando verificación de entorno para Canvas LMS local (Node.js Native Installer)');
    
    const logsDir = path.dirname(this.logFile);
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

    const preflight = new PreflightChecks(this.boot, this.canvasDir);
    const { allOk, missing } = await preflight.runChecks();

    if (!allOk) {
      this.boot.warn('Componentes faltantes detectados. Iniciando instalación automática...');
      
      if (missing.missing_docker || missing.docker_daemon_down) {
        const dockerInstaller = new DockerInstaller(this.boot, this.logFile);
        if (missing.missing_docker) {
          const physicallyInstalled = await dockerInstaller.isDockerInstalled();
          if (physicallyInstalled) {
            this.boot.error('Docker está instalado físicamente en tu sistema, pero el comando "docker" falló.');
            this.boot.action('Por favor, agrégalo a tu variable de entorno PATH, o abre Docker Desktop para configurarlo, y vuelve a intentar.');
            process.exit(1);
          }
          
          this.boot.warn('Docker no está instalado en tu sistema.');
          const pathInfo = dockerInstaller.platform === 'win32' ? 'C:\\Program Files\\Docker\\Docker' : '/Applications';
          const wantsInstall = await askConfirm(`¿Deseas que intente descargarlo e instalarlo automáticamente en la ruta por defecto (${pathInfo})?`);
          
          if (!wantsInstall) {
            this.boot.action('Instala Docker Desktop manualmente desde https://docs.docker.com/desktop/ y vuelve a correr npm start.');
            process.exit(1);
          }

          if (!(await dockerInstaller.installDocker())) throw new Error('Fallo en la instalación automática de Docker');
        } else if (missing.docker_daemon_down) {
          if (process.env.DOCKER_HOST) {
            this.boot.error(`No pudimos conectar con el daemon remoto en DOCKER_HOST (${process.env.DOCKER_HOST}).`);
            this.boot.action('Revisa tu conexión VPN, firewall o configuración de red. El script se detendrá.');
            process.exit(1);
          }
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

      if (missing.missing_plugin_db) {
        this.boot.plain('');
        this.boot.plain('=========================================================');
        this.boot.plain('   CONFIGURANDO BASE DE DATOS Y USUARIOS DEL PLUGIN LOCAL');
        this.boot.plain('=========================================================');
        this.boot.info('Lanzando el orquestador de Node.js...');
        try {
          await execa('npm', ['run', 'setup'], { cwd: this.pluginDir, stdio: 'inherit' });
        } catch (e) {
          throw new Error('Fallo al inicializar la base de datos del plugin local: ' + e.message);
        }
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
