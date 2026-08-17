import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { createSpinner } from 'nanospinner';

import { runCommand, TailBuffer } from './utils/Runner.js';

export class DataSeeder {
  constructor(boot, pluginDir, canvasDir, { runner = runCommand, spawnProcess = spawn } = {}) {
    this.boot = boot;
    this.pluginDir = pluginDir;
    this.canvasDir = canvasDir;
    this.runner = runner;
    this.spawnProcess = spawnProcess;
    this.envFile = path.join(this.pluginDir, '.env');
  }

  async seedData() {
    this.boot.plain('');
    this.boot.plain('--- Initializing test data in Canvas LMS ---');
    const runnerFile = path.join(this.pluginDir, 'tools', 'canvas-local', 'seeds', 'runner.rb');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!fs.existsSync(runnerFile)) {
      this.boot.error(`Could not find main seed script: ${runnerFile}`);
      return false;
    }
    if (!(await this._copySeedFiles())) return false;

    const spinner = createSpinner('Injecting test data (this may take several minutes)...').start();
    return new Promise((resolve) => {
      const child = this.spawnProcess('docker', [
        'compose', 'exec', '-i', 'web', 'bundle', 'exec', 'rails', 'runner', '/tmp/seeds/runner.rb'
      ], { cwd: this.canvasDir, stdio: ['pipe', 'pipe', 'pipe'] });
      const tailLines = new TailBuffer(50);
      const timeoutId = setTimeout(() => {
        spinner.error({ text: 'Timeout while injecting data (10 min).' });
        this.boot.error('Subprocess hung or failed silently. Aborting.');
        child.kill('SIGKILL');
        resolve(false);
      }, 600000);

      child.stdout.on('data', (data) => tailLines.push(data.toString()));
      child.stderr.on('data', (data) => tailLines.push(data.toString()));
      child.on('close', (code) => this._finishSeed(code, spinner, tailLines, timeoutId, resolve));
      child.on('error', (error) => {
        clearTimeout(timeoutId);
        spinner.error({ text: 'Failed to start data injection.' });
        this.boot.error(`Error starting Docker Compose: ${error.message}`);
        resolve(false);
      });
    });
  }

  async _copySeedFiles() {
    this.boot.info('Copying seed directory to Canvas container...');
    const seedsDir = path.join(this.pluginDir, 'tools', 'canvas-local', 'seeds');
    const result = await this.runner('docker', ['compose', 'cp', seedsDir, 'web:/tmp/seeds'], {
      cwd: this.canvasDir
    });
    if (result.success) return true;
    this.boot.error(`Could not copy seed directory to container: ${result.err}`);
    return false;
  }

  _finishSeed(code, spinner, tailLines, timeoutId, resolve) {
    clearTimeout(timeoutId);
    if (code !== 0) {
      spinner.error({ text: 'Error executing seed script.', mark: '  ×' });
      this.boot.error(`Exit code ${code}. Last lines:\n${tailLines.toString()}`);
      resolve(false);
      return;
    }
    spinner.success({ text: 'Database populated successfully.', mark: '  √' });
    this.synchronizeLocalToken().then(() => resolve(true)).catch(() => resolve(true));
  }

  async synchronizeLocalToken() {
    this.boot.info('Extracting profiles and tokens from Canvas container...');
    const { success, out } = await this.runner('docker', [
      'compose', 'exec', '-T', 'web', 'cat', '/usr/src/app/tmp/perfiles_data.json'
    ], { cwd: this.canvasDir, captureAll: true });
    if (!success || !out?.trim()) return;

    try {
      const perfiles = JSON.parse(out);
      const localPath = path.join(this.pluginDir, 'tmp', 'canvas_local_users.json');
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      if (!fs.existsSync(path.dirname(localPath))) fs.mkdirSync(path.dirname(localPath), { recursive: true });
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.writeFileSync(localPath, JSON.stringify(perfiles, null, 2));
      this.boot.info(`Users and tokens exported to ${localPath}`);

      const systemUser = perfiles.usuarios?.find((user) => user.rol === 'system') || perfiles.users?.find((user) => user.role === 'system');
      if (systemUser?.token) this._writeTokenToEnv(systemUser.token);
      else this.boot.warn('System token not found in perfiles_data.json');
      await this._migrateAndSyncUsers(localPath);
    } catch (error) {
      this.boot.warn(`Error parsing perfiles_data.json: ${error.message}`);
    }
  }

  async _migrateAndSyncUsers(localPath) {
    try {
      const { runMigrations } = await import('@plugin-feedback/plugin-database');
      await runMigrations();
      this.boot.info('Incremental migrations applied locally before seeding.');
    } catch (error) {
      this.boot.warn(`Error running pre-seed migrations: ${error.message}`);
    }

    const seedPath = path.join(this.pluginDir, 'packages', 'plugin-database', 'seeds', 'seedLocalUsers.js');
    const result = await this.runner('node', [seedPath, localPath], { cwd: this.pluginDir });
    if (result.success) {
      this.boot.info('Local users successfully synchronized in the plugin PostgreSQL DB.');
      return;
    }
    const output = (result.out || result.err || '').split('\n')
      .filter((line) => line.trim().length > 0).slice(-3).join('\n    ');
    this.boot.error(`Error synchronizing local users in the plugin PostgreSQL DB:\n    ${output}`);
  }

  _writeTokenToEnv(token) {
    let content = '';
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (fs.existsSync(this.envFile)) content = fs.readFileSync(this.envFile, 'utf-8');
    const lines = content.split('\n');
    const tokenLine = `CANVAS_ACCESS_TOKEN=${token}`;
    const existingIndex = lines.findIndex((line) => line.startsWith('CANVAS_ACCESS_TOKEN='));
    // eslint-disable-next-line security/detect-object-injection
    if (existingIndex >= 0) lines[existingIndex] = tokenLine;
    else lines.push(tokenLine);

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.writeFileSync(this.envFile, `${lines.join('\n').replace(/\n+$/, '')}\n`);
    this.boot.info('CANVAS_ACCESS_TOKEN successfully updated in .env.');
  }
}
