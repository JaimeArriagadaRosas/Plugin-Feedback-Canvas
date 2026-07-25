import fs from 'node:fs';
import path from 'node:path';
import { runCommand } from '../utils/Runner.js';

export class CanvasCloner {
  constructor(boot, logFile, canvasDir) {
    this.boot = boot;
    this.logFile = logFile;
    this.canvasDir = canvasDir;
  }

  async cloneCanvas() {
    this.boot.info(`Clonando repositorio Canvas LMS en: ${this.canvasDir}`);
    
    const composeFile = path.join(this.canvasDir, 'docker-compose.yml');
    if (fs.existsSync(composeFile)) {
      this.boot.info('La carpeta canvas-lms-master ya tiene el código base. Se omitirá la clonación.');
      this._configureBasicEnv();
      this._configureDockerOverride();
      this._fixCRLF();
      return true;
    } else if (fs.existsSync(this.canvasDir)) {
      this.boot.warn('La carpeta canvas-lms-master existe pero está incompleta o corrupta. Limpiando y volviendo a clonar...');
      fs.rmSync(this.canvasDir, { recursive: true, force: true });
    }

    let gitCmd = 'git';
    
    // Check if git is globally available
    const { success: gitCheck } = await runCommand(gitCmd, ['--version']);
    if (!gitCheck) {
      // Fallback for GitHub Desktop on Windows
      const userProfile = process.env.USERPROFILE;
      if (userProfile) {
        const ghDesktopDir = path.join(userProfile, 'AppData', 'Local', 'GitHubDesktop');
        if (fs.existsSync(ghDesktopDir)) {
          const apps = fs.readdirSync(ghDesktopDir).filter(d => d.startsWith('app-'));
          if (apps.length > 0) {
            // Sort to get the latest app version
            apps.sort().reverse();
            const ghGitPath = path.join(ghDesktopDir, apps[0], 'resources', 'app', 'git', 'cmd', 'git.exe');
            if (fs.existsSync(ghGitPath)) {
              gitCmd = ghGitPath;
              this.boot.info(`Usando git embebido desde GitHub Desktop: ${gitCmd}`);
            }
          }
        }
      }
    }

    let { success, err } = await runCommand(gitCmd, [
      '-c', 'core.autocrlf=false',
      '-c', 'core.eol=lf',
      'clone', '--depth', '1', '-b', 'prod',
      'https://github.com/instructure/canvas-lms.git',
      this.canvasDir
    ], { logFile: this.logFile });

    if (!success) {
      this.boot.warn(`No se pudo clonar con git: ${err}`);
      this.boot.info('Intentando fallback: descargando prod.zip nativamente...');
      
      const zipUrl = 'https://github.com/instructure/canvas-lms/archive/refs/heads/prod.zip';
      const tmpZip = path.join(process.env.TEMP || '/tmp', 'canvas-lms-prod.zip');
      
      const platform = process.platform;
      let downloadSuccess = false;
      if (platform === 'win32') {
        const { success: dl } = await runCommand('powershell', ['-Command', `Invoke-WebRequest -Uri "${zipUrl}" -OutFile "${tmpZip}"`], { logFile: this.logFile });
        downloadSuccess = dl;
      } else {
        const { success: dl } = await runCommand('curl', ['-L', '-o', tmpZip, zipUrl], { logFile: this.logFile });
        downloadSuccess = dl;
      }

      if (!downloadSuccess) {
        this.boot.error('Falló la descarga del ZIP de respaldo. Verifique su conexión de red.');
        return false;
      }
      
      this.boot.info('Extrayendo ZIP...');
      let extractSuccess = false;
      if (platform === 'win32') {
        const { success: ex } = await runCommand('powershell', ['-Command', `Expand-Archive -Path "${tmpZip}" -DestinationPath "${path.dirname(this.canvasDir)}" -Force`], { logFile: this.logFile });
        extractSuccess = ex;
      } else {
        const { success: ex } = await runCommand('unzip', ['-q', tmpZip, '-d', path.dirname(this.canvasDir)], { logFile: this.logFile });
        extractSuccess = ex;
      }

      if (!extractSuccess) {
        this.boot.error('Falló la extracción del ZIP de respaldo.');
        return false;
      }
      
      const extractedDir = path.join(path.dirname(this.canvasDir), 'canvas-lms-prod');
      if (fs.existsSync(extractedDir)) {
        if (fs.existsSync(this.canvasDir)) {
          fs.rmSync(this.canvasDir, { recursive: true, force: true });
        }
        fs.renameSync(extractedDir, this.canvasDir);
      }
    }

    this.boot.info('Canvas LMS clonado correctamente.');
    this._configureBasicEnv();
    this._configureDockerOverride();
    this._fixCRLF();

    this.boot.info('Iniciando servicios base de Canvas (Docker Compose up -d)...');
    const upRes = await runCommand('docker', ['compose', 'up', '-d'], { cwd: this.canvasDir, logFile: this.logFile });
    if (!upRes.success) {
      this.boot.error('No se pudo iniciar Docker Compose.');
      return false;
    }

    return true;
  }

  _configureBasicEnv() {
    const envFile = path.join(this.canvasDir, '.env');
    const envExample = path.join(this.canvasDir, '.env.example');
    
    if (fs.existsSync(envExample)) {
      fs.copyFileSync(envExample, envFile);
      this.boot.info('Copiando .env.example a .env...');
    } else {
      fs.writeFileSync(envFile, `POSTGRES_PASSWORD=sekret
CANVAS_LMS_ADMIN_EMAIL=admin@example.com
CANVAS_LMS_ADMIN_PASSWORD=password123
CANVAS_LMS_HOST=localhost:8080
`);
      this.boot.info('Creando archivo .env básico...');
    }
  }

  _configureDockerOverride() {
    const overrideFile = path.join(this.canvasDir, 'docker-compose.override.yml');
    if (!fs.existsSync(overrideFile)) {
      fs.writeFileSync(overrideFile, `services:
  jobs:
    mem_limit: 2g
    cpus: '1'
    volumes:
      - .:/usr/src/app
      - canvas-bundle-gems:/home/docker/.gem
  web:
    mem_limit: 4g
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
  }

  _fixCRLF() {
    const shFile = path.join(this.canvasDir, 'docker-compose', 'postgres', 'create-dbs.sh');
    if (fs.existsSync(shFile)) {
      const content = fs.readFileSync(shFile);
      // Replace \r\n with \n buffer safely
      const lfContent = Buffer.from(content.toString('binary').replace(/\r\n/g, '\n'), 'binary');
      fs.writeFileSync(shFile, lfContent);
      this.boot.info('Corrigiendo CRLF en script de BD.');
    }
  }
}
