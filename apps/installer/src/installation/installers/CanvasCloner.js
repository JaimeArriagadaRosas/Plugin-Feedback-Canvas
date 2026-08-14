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
    this.boot.info(`Cloning Canvas LMS repository to: ${this.canvasDir}`);
    const directoryState = this._getDirectoryState();
    if (directoryState === 'ready') return this._reuseCanvasDirectory();
    if (directoryState === 'unsafe-existing-directory') return this._reportUnsafeDirectory();

    const cloneOutcome = await this._cloneWithGit();
    if (!cloneOutcome.success) {
      if (!cloneOutcome.canUseArchiveFallback || !(await this._downloadArchiveFallback())) return false;
    }

    this.boot.info('Canvas LMS cloned correctly.');
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
    this.boot.info('The canvas-lms-master folder already has the codebase. Cloning will be skipped.');
    this._configureBasicEnv();
    this._configureDockerOverride();
    this._fixCRLF();
    return true;
  }

  _reportUnsafeDirectory() {
    this.boot.error('The Canvas folder exists, but does not contain a recognizable docker-compose.yml.');
    this.boot.action('It will not be automatically deleted. Review, backup or rename the folder before retrying the setup.');
    return false;
  }

  async _cloneWithGit() {
    const gitCommand = await this._getGitCommand();
    const result = await this.runner(gitCommand, [
      '-c', 'core.autocrlf=false', '-c', 'core.eol=lf',
      'clone', '--depth', '1', '-b', CANVAS_RELEASE, CANVAS_REPOSITORY, this.canvasDir
    ], { logFile: this.logFile });
    if (result.success) return { success: true, canUseArchiveFallback: false };

    this.boot.warn(`Could not clone with git: ${result.err}`);
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (fs.existsSync(this.canvasDir)) {
      this.boot.error('Git left a partial Canvas folder. It will be preserved for diagnosis.');
      this.boot.action('Review or manually delete the partial folder before using the ZIP fallback.');
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
      this.boot.info(`Using embedded git from GitHub Desktop: ${embeddedGit}`);
      return embeddedGit;
    }
    return globalGit;
  }

  async _downloadArchiveFallback() {
    this.boot.info('Attempting fallback: downloading ZIP natively...');
    const zipFile = path.join(process.env.TEMP || '/tmp', 'canvas-lms-release.zip');
    const extractedDir = path.join(path.dirname(this.canvasDir), CANVAS_ZIP_DIRECTORY);
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (fs.existsSync(extractedDir)) {
      this.boot.error('An extracted Canvas directory already exists. It will not be merged with a new download.');
      this.boot.action('Review or rename the extracted directory before retrying the ZIP fallback.');
      return false;
    }
    const extracted = await this.archiveInstaller.downloadAndExtract({
      url: CANVAS_ZIP_URL,
      zipFile,
      destinationDir: path.dirname(this.canvasDir),
      logFile: this.logFile
    });
    if (!extracted) {
      this.boot.error('Failed to download or extract the backup ZIP.');
      return false;
    }

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!fs.existsSync(extractedDir)) {
      this.boot.error('The ZIP did not contain the expected Canvas directory.');
      return false;
    }
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (fs.existsSync(this.canvasDir)) {
      this.boot.error('The ZIP fallback found an existing Canvas destination and will not replace it.');
      this.boot.action('Review or rename the existing destination and the extracted directory before retrying.');
      return false;
    }
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.renameSync(extractedDir, this.canvasDir);
    return true;
  }

  async _startCanvasServices() {
    this.boot.info('Starting base Canvas services (Docker Compose up -d)...');
    let result = await this.runner('docker', ['compose', 'up', '-d'], {
      cwd: this.canvasDir, logFile: this.logFile
    });
    if (result.success) return true;

    this.boot.warn('Failed to start Docker Compose. Attempting restart without destroying volumes...');
    await this.runner('docker', ['compose', 'down'], { cwd: this.canvasDir, logFile: this.logFile });
    result = await this.runner('docker', ['compose', 'up', '-d'], {
      cwd: this.canvasDir, logFile: this.logFile
    });
    if (!result.success) {
      this.boot.error('The soft restart failed; volumes will not be automatically deleted.');
      this.boot.action('Review `docker compose logs`, backup and authorize any data reset separately.');
      return false;
    }
    this.boot.success('Docker Compose started correctly after a non-destructive restart.');
    return true;
  }

  _configureBasicEnv() {
    const envFile = path.join(this.canvasDir, '.env');
    const envExample = path.join(this.canvasDir, '.env.example');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (fs.existsSync(envFile)) {
      this.boot.info('The existing Canvas .env is preserved.');
      return;
    }
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (fs.existsSync(envExample)) {
      fs.copyFileSync(envExample, envFile);
      this.boot.info('Copying .env.example to .env...');
      return;
    }
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.writeFileSync(envFile, `POSTGRES_PASSWORD=sekret
CANVAS_LMS_ADMIN_EMAIL=admin@example.com
CANVAS_LMS_ADMIN_PASSWORD=password123
CANVAS_LMS_HOST=localhost:8080
`);
    this.boot.info('Creating basic .env file...');
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
    this.boot.info('Resource optimizations applied (docker-compose.override.yml).');
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
    this.boot.info('Fixing CRLF in DB script.');
  }
}
