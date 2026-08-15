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
    this.boot.plain('--- Inicializando datos de prueba en Canvas LMS ---');
    const runnerFile = path.join(this.pluginDir, 'tools', 'canvas-local', 'seeds', 'runner.rb');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!fs.existsSync(runnerFile)) {
      this.boot.error(`No se encontro el script de semilla principal: ${runnerFile}`);
      return false;
    }
    if (!(await this._copySeedFiles())) return false;

    const spinner = createSpinner('Inyectando datos de prueba (puede tardar varios minutos)...').start();
    return new Promise((resolve) => {
      const child = this.spawnProcess('docker', [
        'compose', 'exec', '-i', 'web', 'bundle', 'exec', 'rails', 'runner', '/tmp/seeds/runner.rb'
      ], { cwd: this.canvasDir, stdio: ['pipe', 'pipe', 'pipe'] });
      const tailLines = new TailBuffer(50);
      const timeoutId = setTimeout(() => {
        spinner.error({ text: 'Tiempo de espera agotado al inyectar datos (10 min).' });
        this.boot.error('El subproceso se colgo o fallo silenciosamente. Abortando.');
        child.kill('SIGKILL');
        resolve(false);
      }, 600000);

      child.stdout.on('data', (data) => tailLines.push(data.toString()));
      child.stderr.on('data', (data) => tailLines.push(data.toString()));
      child.on('close', (code) => this._finishSeed(code, spinner, tailLines, timeoutId, resolve));
      child.on('error', (error) => {
        clearTimeout(timeoutId);
        spinner.error({ text: 'Fallo al iniciar inyeccion de datos.' });
        this.boot.error(`Error al iniciar docker compose: ${error.message}`);
        resolve(false);
      });
    });
  }

  async _copySeedFiles() {
    this.boot.info('Copiando directorio de semillas al contenedor Canvas...');
    const seedsDir = path.join(this.pluginDir, 'tools', 'canvas-local', 'seeds');
    const result = await this.runner('docker', ['compose', 'cp', seedsDir, 'web:/tmp/seeds'], {
      cwd: this.canvasDir
    });
    if (result.success) return true;
    this.boot.error(`No se pudo copiar el directorio de semillas al contenedor: ${result.err}`);
    return false;
  }

  _finishSeed(code, spinner, tailLines, timeoutId, resolve) {
    clearTimeout(timeoutId);
    if (code !== 0) {
      spinner.error({ text: 'Error al ejecutar el script de semilla.', mark: '  ×' });
      this.boot.error(`Código de salida ${code}. Últimas líneas:\n${tailLines.toString()}`);
      resolve(false);
      return;
    }
    spinner.success({ text: 'Base de datos poblada exitosamente.', mark: '  √' });
    this.synchronizeLocalToken().then(() => resolve(true)).catch(() => resolve(true));
  }

  async synchronizeLocalToken() {
    this.boot.info('Extrayendo perfiles y tokens completos desde el contenedor de Canvas...');
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
      this.boot.info(`Usuarios y tokens exportados a ${localPath}`);

      const systemUser = perfiles.usuarios?.find((user) => user.rol === 'system') || perfiles.users?.find((user) => user.role === 'system');
      if (systemUser?.token) this._writeTokenToEnv(systemUser.token);
      else this.boot.warn('No se encontro token de sistema en perfiles_data.json');
      await this._migrateAndSyncUsers(localPath);
    } catch (error) {
      this.boot.warn(`Error parseando perfiles_data.json: ${error.message}`);
    }
  }

  async _migrateAndSyncUsers(localPath) {
    try {
      const { runMigrations } = await import('@plugin-feedback/plugin-database');
      await runMigrations();
      this.boot.info('Migraciones incrementales aplicadas localmente antes del seed.');
    } catch (error) {
      this.boot.warn(`Error ejecutando migraciones pre-seed: ${error.message}`);
    }

    const seedPath = path.join(this.pluginDir, 'packages', 'plugin-database', 'seeds', 'seedLocalUsers.js');
    const result = await this.runner('node', [seedPath, localPath], { cwd: this.pluginDir });
    if (result.success) {
      this.boot.info('Usuarios locales sincronizados con exito en la BD PostgreSQL del plugin.');
      return;
    }
    const output = (result.out || result.err || '').split('\n')
      .filter((line) => line.trim().length > 0).slice(-3).join('\n    ');
    this.boot.error(`Error al sincronizar usuarios locales en la BD PostgreSQL del plugin:\n    ${output}`);
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
    this.boot.info('CANVAS_ACCESS_TOKEN actualizado en .env correctamente.');
  }
}
