import { runCommand } from './utils/Runner.js';
import { RubyDependencyInstaller } from './installers/RubyDependencyInstaller.js';
import { createSpinner } from 'nanospinner';

/**
 * DatabaseHealth — Resilient PostgreSQL verification.
 *
 * Estrategia:
 *  1. Usa `pg_isready` (no healthcheck de Docker) para sondear la disponibilidad.
 *  2. Exponential backoff: waits progressively longer between retries.
 *  3. Corruption detection: reads container logs looking for patterns
 *     de PANIC/FATAL irrecuperables y, si los encuentra, se detiene sin borrar datos.
 *  4. No rigid timeout: the loop runs until Postgres responds or an
 *     unrecoverable block is detected (max ~15 min with backoff).
 */
export class DatabaseHealth {
  constructor(boot, canvasDir) {
    this.boot = boot;
    this.canvasDir = canvasDir;
  }

  async ensureDatabaseReady() {
    this.boot.info('Verifying PostgreSQL database status...');

    // Primero verificar/instalar plugins de Bundler
    const rubyDependencyInstaller = new RubyDependencyInstaller(this.boot, this.canvasDir);
    if (!(await rubyDependencyInstaller.ensureBundlerPlugins())) {
      throw new Error('Fallo al instalar plugins de Bundler requeridos.');
    }

    const serviceName = await this._detectPgService();
    if (serviceName) {
      const dbHealthy = await this.waitForPostgres(serviceName);
      if (!dbHealthy) {
        throw new Error(`Could not establish connection with PostgreSQL (${serviceName}).`);
      }
    } else {
      this.boot.warn('No se pudo detectar el servicio de Postgres en docker-compose, asumiendo listo.');
    }

    const migrationsDone = await this.checkMigrations();
    if (!migrationsDone) {
      this.boot.warn('The database is not migrated. Running migrations (this will take several minutes)...');
      const migrated = await this.runMigrations();
      if (!migrated) {
        throw new Error('Fallo al crear y migrar la base de datos.');
      }
    }
    return true;
  }

  async _detectPgService() {
    const { success, out } = await runCommand('docker', ['compose', 'config', '--services'], { cwd: this.canvasDir, captureAll: true });
    if (success) {
      const services = out.split('\n').map(s => s.trim());
      if (services.includes('postgres')) return 'postgres';
      if (services.includes('db')) return 'db';
    }
    return null;
  }

  /**
   * Espera a que Postgres acepte conexiones usando `pg_isready`.
   * Usa exponential backoff (3s → 6s → 12s → ... hasta 30s) con un
   * maximum of 30 attempts (~15 min in the worst case).
   *
   * En cada ciclo revisa los logs del contenedor buscando indicios de
   * unrecoverable corruption. If found, demands explicit intervention.
   */
  async waitForPostgres(serviceName, maxAttempts = 30) {
    const spinner = createSpinner(`Esperando a que ${serviceName} acepte conexiones...`).start();

    const { success: psSuccess, out: psOut } = await runCommand(
      'docker', ['compose', 'ps', '-q', serviceName], { cwd: this.canvasDir, captureAll: true }
    );

    if (!psSuccess || !psOut.trim()) {
      spinner.error({ text: `Container for service ${serviceName} not found` });
      return false;
    }
    const containerId = psOut.trim();

    let waitMs = 3000; // Empieza en 3s
    const MAX_WAIT = 30000; // Cap en 30s

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // --- Sondeo con pg_isready ---
      const { success } = await runCommand(
        'docker', ['exec', containerId, 'pg_isready', '-U', 'postgres'],
        { cwd: this.canvasDir, timeout: 10000, captureAll: true }
      );

      if (success) {
        spinner.success({ text: `${serviceName} is ready and accepting connections.`, mark: '  √' });
        return true;
      }

      // --- Corruption detection in logs ---
      const corruption = await this._detectCorruption(containerId);
      if (corruption) {
        spinner.error({ text: `Possible corruption detected in ${serviceName}.` });
        this.boot.error(`[DATA-SAFETY] Pattern detected: ${corruption}`);
        this.boot.action('Stop the setup, backup the volume and execute an explicit restore/reset runbook.');
        return false;
      }

      // --- Backoff exponencial ---
      spinner.update({
        text: `Waiting for ${serviceName} to accept connections... (attempt ${attempt}/${maxAttempts}, next in ${(waitMs / 1000).toFixed(0)}s)`
      });
      await new Promise(r => setTimeout(r, waitMs));
      waitMs = Math.min(waitMs * 1.5, MAX_WAIT);
    }

    spinner.error({ text: `${serviceName} did not respond after ${maxAttempts} attempts.` });
    this.boot.error('PostgreSQL failed to accept connections. Possible causes:');
    this.boot.error('  - Docker tiene muy poca RAM asignada y Postgres no logra arrancar.');
    this.boot.error('  - The data volume may be corrupted; it will not be automatically deleted.');
    return false;
  }

  /**
   * Reads the latest logs from the Postgres container and looks for patterns
   * of unrecoverable corruption (PANIC, FATAL with checkpoint, WAL corruption).
   */
  async _detectCorruption(containerId) {
    const { success, out } = await runCommand(
      'docker', ['logs', '--tail', '50', containerId],
      { cwd: this.canvasDir, timeout: 10000, captureAll: true }
    );

    if (!success || !out) return null;

    const corruptionPatterns = [
      /PANIC:.*could not locate a valid checkpoint record/i,
      /FATAL:.*could not open file.*No such file or directory/i,
      /PANIC:.*invalid resource manager ID in primary checkpoint record/i,
      /FATAL:.*database files are incompatible with server/i,
      /FATAL:.*data directory.*has wrong ownership/i,
      /PANIC:.*could not redo log record/i
    ];

    for (const pattern of corruptionPatterns) {
      const match = out.match(pattern);
      if (match) return match[0];
    }

    return null;
  }

  async checkMigrations() {
    const { createSpinner } = await import('nanospinner');
    const spinner = createSpinner('Verifying database structure (starting Rails Runner)...').start();
    const script = "ActiveRecord::Base.connection.table_exists?('accounts') ? exit(0) : exit(1)";
    const { success } = await runCommand('docker', ['compose', 'exec', '-T', 'web', 'bundle', 'exec', 'rails', 'runner', script], { cwd: this.canvasDir });

    if (success) {
      spinner.success({ text: 'Estructura de la base de datos verificada correctamente.', mark: '  √' });
    } else {
      spinner.warn({ text: 'The database is not initialized or tables are missing.', mark: '  !' });
    }
    return success;
  }

  async runMigrations() {
    const { spawn } = await import('node:child_process');
    const { TailBuffer } = await import('./utils/Runner.js');
    const spinner = createSpinner('Ejecutando db:create db:migrate...').start();

    return new Promise((resolve) => {
      const child = spawn('docker', ['compose', 'exec', '-T', '-e', 'RAILS_ENV=development', 'web', 'bundle', 'exec', 'rake', 'db:create', 'db:migrate'], {
        cwd: this.canvasDir,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      const tailLines = new TailBuffer(50);
      child.stdout.on('data', (data) => tailLines.push(data.toString()));
      child.stderr.on('data', (data) => tailLines.push(data.toString()));

      child.on('close', (code) => {
        if (code === 0) {
          spinner.success({ text: 'Migrations completed successfully.', mark: '  √' });
          resolve(true);
        } else {
          spinner.error({ text: `Failed to run migrations (code ${code})`, mark: '  X' });
          this.boot.error(`Exit code ${code}. Last lines:\n${tailLines.toString()}`);
          resolve(false);
        }
      });

      child.on('error', (err) => {
        spinner.error({ text: 'Failed to invoke docker compose process', mark: '  !' });
        this.boot.error(err.message);
        resolve(false);
      });
    });
  }
}
