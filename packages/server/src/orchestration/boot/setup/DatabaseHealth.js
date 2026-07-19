import { runCommand } from './utils/Runner.js';
import { createSpinner } from 'nanospinner';

export class DatabaseHealth {
  constructor(boot, canvasDir) {
    this.boot = boot;
    this.canvasDir = canvasDir;
  }

  async ensureDatabaseReady() {
    this.boot.info('Verificando estado de la base de datos PostgreSQL...');
    
    const serviceName = await this._detectPgService();
    if (serviceName) {
      const dbHealthy = await this.pollContainerHealth(serviceName, 300); // 5 mins
      if (!dbHealthy) {
        this.boot.error(`El contenedor ${serviceName} no reportó estado healthy a tiempo.`);
        throw new Error(`Database ${serviceName} timeout`);
      }
    } else {
      this.boot.warn('No se pudo detectar el servicio de Postgres en docker-compose, asumiendo listo.');
    }

    const migrationsDone = await this.checkMigrations();
    if (!migrationsDone) {
      this.boot.warn('La base de datos no está migrada. Ejecutando migraciones (esto tomará varios minutos)...');
      const migrated = await this.runMigrations();
      if (!migrated) {
        throw new Error('Fallo al crear y migrar la base de datos.');
      }
    } else {
      this.boot.info('Estructura de la base de datos verificada correctamente.');
    }
    return true;
  }

  async _detectPgService() {
    const { success, out } = await runCommand('docker', ['compose', 'config', '--services'], { cwd: this.canvasDir });
    if (success) {
      const services = out.split('\n').map(s => s.trim());
      if (services.includes('postgres')) return 'postgres';
      if (services.includes('db')) return 'db';
    }
    return null;
  }

  async pollContainerHealth(serviceName, timeoutSeconds) {
    const spinner = createSpinner(`Esperando a que ${serviceName} esté healthy...`).start();
    const start = Date.now();
    const timeoutMs = timeoutSeconds * 1000;

    const { success: psSuccess, out: psOut } = await runCommand('docker', ['compose', 'ps', '-q', serviceName], { cwd: this.canvasDir });
    
    if (!psSuccess || !psOut.trim()) {
      spinner.error({ text: `No se pudo encontrar el contenedor para el servicio ${serviceName}` });
      return false;
    }
    const containerId = psOut.trim();

    while (Date.now() - start < timeoutMs) {
      const { success, out } = await runCommand('docker', ['inspect', '--format={{json .State.Health.Status}}', containerId], { cwd: this.canvasDir });
      if (success) {
        const status = out.replace(/"/g, '').trim();
        // Si no tiene healthcheck, podría devolver "" o "unhealthy", iteramos.
        // Asumimos que Canvas usa healthchecks oficiales.
        if (status === 'healthy') {
          spinner.success({ text: `${serviceName} está healthy.` });
          return true;
        }
      }
      await new Promise(r => setTimeout(r, 3000));
    }
    spinner.error({ text: `Timeout esperando a ${serviceName}.` });
    return false;
  }

  async checkMigrations() {
    const script = "ActiveRecord::Base.connection.table_exists?('accounts') ? exit(0) : exit(1)";
    const { success } = await runCommand('docker', ['compose', 'exec', '-T', 'web', 'bundle', 'exec', 'rails', 'runner', script], { cwd: this.canvasDir });
    return success;
  }

  async runMigrations() {
    const { spawn } = await import('node:child_process');
    const spinner = createSpinner('Ejecutando db:create db:migrate...').start();
    
    return new Promise((resolve) => {
      const child = spawn('docker', ['compose', 'exec', '-T', 'web', 'bundle', 'exec', 'rake', 'db:create', 'db:migrate'], {
        cwd: this.canvasDir,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let logs = '';
      child.stdout.on('data', (data) => logs += data.toString());
      child.stderr.on('data', (data) => logs += data.toString());

      child.on('close', (code) => {
        if (code === 0) {
          spinner.success({ text: 'Migraciones completadas exitosamente.' });
          resolve(true);
        } else {
          spinner.error({ text: 'Error al ejecutar migraciones.' });
          this.boot.error(`Código de salida ${code}. Logs parciales:\n${logs.substring(Math.max(0, logs.length - 2000))}`);
          resolve(false);
        }
      });
      
      child.on('error', (err) => {
        spinner.error({ text: 'Fallo al invocar el proceso docker compose' });
        this.boot.error(err.message);
        resolve(false);
      });
    });
  }
}
