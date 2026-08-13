import fs from 'node:fs';
import path from 'node:path';

import { runCommand } from '../utils/Runner.js';
import { getCanvasDirectoryState } from './CanvasDirectoryState.js';
import { createCanvasArchiveInstaller } from '../../platform/shared/CanvasArchiveInstallerFactory.js';
import { createGitCommandLocator } from '../../platform/shared/GitCommandLocatorFactory.js';

const CANVAS_RELEASE = 'release/2026-05-20.143';
const CANVAS_REPOSITORY = 'https://github.com/instructure/canvas-lms.git';
const CANVAS_ZIP_URL = 'https://github.com/instructure/canvas-lms/archive/refs/tags/release/2026-05-20.143.zip';
const CANVAS_ZIP_DIRECTORY = 'canvas-lms-release-2026-05-20.143';

export class CanvasCloner {
  constructor(boot, logFile, canvasDir, {
    runner = runCommand,
    platform = process.platform,
    archiveInstaller,
    gitCommandLocator
  } = {}) {
    this.boot = boot;
    this.logFile = logFile;
    this.canvasDir = canvasDir;
    this.runner = runner;
    this.archiveInstaller = archiveInstaller || createCanvasArchiveInstaller(platform, { runner });
    this.gitCommandLocator = gitCommandLocator || createGitCommandLocator(platform, { fs });
  }

  async cloneCanvas() {
    this.boot.info(`Clonando repositorio Canvas LMS en: ${this.canvasDir}`);
    const directoryState = this._getDirectoryState();
    if (directoryState === 'ready') return this._reuseCanvasDirectory();
    if (directoryState === 'unsafe-existing-directory') return this._reportUnsafeDirectory();

    const cloneOutcome = await this._cloneWithGit();
    if (!cloneOutcome.success) {
      if (!cloneOutcome.canUseArchiveFallback || !(await this._downloadArchiveFallback())) return false;
    }

    this.boot.info('Canvas LMS clonado correctamente.');
    this._configureBasicEnv();
    this._configureDockerOverride();
    this._fixCRLF();
    return this._startCanvasServices();
  }

  _getDirectoryState() {
    const composeFile = path.join(this.canvasDir, 'docker-compose.yml');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const targetExists = fs.existsSync(this.canvasDir);
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const composeExists = fs.existsSync(composeFile);
    return getCanvasDirectoryState({ targetExists, composeExists });
  }

  _reuseCanvasDirectory() {
    this.boot.info('La carpeta canvas-lms-master ya tiene el codigo base. Se omitira la clonacion.');
    this._configureBasicEnv();
    this._configureDockerOverride();
    this._fixCRLF();
    return true;
  }

  _reportUnsafeDirectory() {
    this.boot.error('La carpeta de Canvas existe, pero no contiene un docker-compose.yml reconocible.');
    this.boot.action('No se eliminara automaticamente. Revise, respalde o renombre la carpeta antes de reintentar el setup.');
    return false;
  }

  async _cloneWithGit() {
    const gitCommand = await this._getGitCommand();
    const result = await this.runner(gitCommand, [
      '-c', 'core.autocrlf=false', '-c', 'core.eol=lf',
      'clone', '--depth', '1', '-b', CANVAS_RELEASE, CANVAS_REPOSITORY, this.canvasDir
    ], { logFile: this.logFile });
    if (result.success) return { success: true, canUseArchiveFallback: false };

    this.boot.warn(`No se pudo clonar con git: ${result.err}`);
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (fs.existsSync(this.canvasDir)) {
      this.boot.error('Git dejo una carpeta de Canvas parcial. Se preservara para diagnostico.');
      this.boot.action('Revise o elimine manualmente la carpeta parcial antes de usar el fallback ZIP.');
      return { success: false, canUseArchiveFallback: false };
    }
    return { success: false, canUseArchiveFallback: true };
  }

  async _getGitCommand() {
    const globalGit = 'git';
    const globalResult = await this.runner(globalGit, ['--version']);
    if (globalResult.success) return globalGit;

    const embeddedGit = this.gitCommandLocator.find();
    if (embeddedGit) {
      this.boot.info(`Usando git embebido desde GitHub Desktop: ${embeddedGit}`);
      return embeddedGit;
    }
    return globalGit;
  }

  async _downloadArchiveFallback() {
    this.boot.info('Intentando fallback: descargando ZIP nativamente...');
    const zipFile = path.join(process.env.TEMP || '/tmp', 'canvas-lms-release.zip');
    const extractedDir = path.join(path.dirname(this.canvasDir), CANVAS_ZIP_DIRECTORY);
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (fs.existsSync(extractedDir)) {
      this.boot.error('Ya existe un directorio extraido de Canvas. No se combinara con una descarga nueva.');
      this.boot.action('Revise o renombre el directorio extraido antes de reintentar el fallback ZIP.');
      return false;
    }
    const extracted = await this.archiveInstaller.downloadAndExtract({
      url: CANVAS_ZIP_URL,
      zipFile,
      destinationDir: path.dirname(this.canvasDir),
      logFile: this.logFile
    });
    if (!extracted) {
      this.boot.error('Fallo la descarga o extraccion del ZIP de respaldo.');
      return false;
    }

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!fs.existsSync(extractedDir)) {
      this.boot.error('El ZIP no contenia el directorio esperado de Canvas.');
      return false;
    }
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (fs.existsSync(this.canvasDir)) {
      this.boot.error('El fallback ZIP encontro un destino Canvas existente y no lo reemplazara.');
      this.boot.action('Revise o renombre el destino existente y el directorio extraido antes de reintentar.');
      return false;
    }
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.renameSync(extractedDir, this.canvasDir);
    return true;
  }

  async _startCanvasServices() {
    this.boot.info('Iniciando servicios base de Canvas (Docker Compose up -d)...');
    let result = await this.runner('docker', ['compose', 'up', '-d'], {
      cwd: this.canvasDir, logFile: this.logFile
    });
    if (result.success) return true;

    this.boot.warn('Fallo al iniciar Docker Compose. Intentando reinicio sin destruir volumenes...');
    await this.runner('docker', ['compose', 'down'], { cwd: this.canvasDir, logFile: this.logFile });
    result = await this.runner('docker', ['compose', 'up', '-d'], {
      cwd: this.canvasDir, logFile: this.logFile
    });
    if (!result.success) {
      this.boot.error('El reinicio suave fallo; no se eliminaran volumenes automaticamente.');
      this.boot.action('Revise `docker compose logs`, haga backup y autorice cualquier reset de datos por separado.');
      return false;
    }
    this.boot.success('Docker Compose inicio correctamente tras un reinicio no destructivo.');
    return true;
  }

  _configureBasicEnv() {
    const envFile = path.join(this.canvasDir, '.env');
    const envExample = path.join(this.canvasDir, '.env.example');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (fs.existsSync(envFile)) {
      this.boot.info('Se conserva el .env existente de Canvas.');
      return;
    }
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (fs.existsSync(envExample)) {
      fs.copyFileSync(envExample, envFile);
      this.boot.info('Copiando .env.example a .env...');
      return;
    }
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.writeFileSync(envFile, `POSTGRES_PASSWORD=sekret
CANVAS_LMS_ADMIN_EMAIL=admin@example.com
CANVAS_LMS_ADMIN_PASSWORD=password123
CANVAS_LMS_HOST=localhost:8080
`);
    this.boot.info('Creando archivo .env basico...');
  }

  _configureDockerOverride() {
    const overrideFile = path.join(this.canvasDir, 'docker-compose.override.yml');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (fs.existsSync(overrideFile)) return;
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.writeFileSync(overrideFile, `services:
  jobs:
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1'
    volumes:
      - .:/usr/src/app
      - canvas-bundle-gems:/home/docker/.gem
  web:
    deploy:
      resources:
        limits:
          memory: 4G
          cpus: '2'
    ports:
      - "8080:80"
    environment:
      RSPACK: 'true'
      CANVAS_LTI_COURSE_NAVIGATION: 'true'
    volumes:
      - .:/usr/src/app
      - canvas-bundle-gems:/home/docker/.gem

volumes:
  canvas-bundle-gems:
`);
    this.boot.info('Optimizaciones de recursos aplicadas (docker-compose.override.yml).');
  }

  _fixCRLF() {
    const shFile = path.join(this.canvasDir, 'docker-compose', 'postgres', 'create-dbs.sh');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!fs.existsSync(shFile)) return;
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const content = fs.readFileSync(shFile);
    const lfContent = Buffer.from(content.toString('binary').replace(/\r\n/g, '\n'), 'binary');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.writeFileSync(shFile, lfContent);
    this.boot.info('Corrigiendo CRLF en script de BD.');
  }
}
