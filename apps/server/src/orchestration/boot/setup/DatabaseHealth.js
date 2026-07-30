import { runCommand } from './utils/Runner.js';
import { createSpinner } from 'nanospinner';
import { GemInstaller } from './installers/GemInstaller.js';

/**
 * DatabaseHealth — Verificación resiliente de PostgreSQL.
 *
 * Estrategia:
 *  1. Usa `pg_isready` (no healthcheck de Docker) para sondear la disponibilidad.
 *  2. Exponential backoff: espera progresivamente más entre reintentos.
 *  3. Detección de corrupción: lee los logs del contenedor buscando patrones
 *     de PANIC/FATAL irrecuperables y, si los encuentra, destruye el volumen
 *     y reinicia desde cero.
 *  4. Sin timeout rígido: el bucle corre hasta que Postgres responde o se
 *     detecta un bloqueo irrecuperable (máx ~15 min con backoff).
 */
export class DatabaseHealth {
  constructor(boot, canvasDir) {
    this.boot = boot;
    this.canvasDir = canvasDir;
  }

  async ensureDatabaseReady() {
    this.boot.info('Verificando estado de la base de datos PostgreSQL...');
    
    // Primero verificar/instalar plugins de Bundler
    const gemInstaller = new GemInstaller(this.boot, this.canvasDir);
    if (!(await gemInstaller.ensureBundlerPlugins())) {
      throw new Error('Fallo al instalar plugins de Bundler requeridos.');
    }
    
    const serviceName = await this._detectPgService();
    if (serviceName) {
      const dbHealthy = await this.waitForPostgres(serviceName);
      if (!dbHealthy) {
        // Si waitForPostgres retornó false, ya intentó auto-recovery.
        throw new Error(`No se pudo establecer conexión con PostgreSQL (${serviceName}).`);
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
   * máximo de 30 intentos (~15 min en el peor caso).
   * 
   * En cada ciclo revisa los logs del contenedor buscando indicios de
   * corrupción irrecuperable. Si los encuentra, ejecuta auto-recovery.
   */
  async waitForPostgres(serviceName, maxAttempts = 30) {
    const spinner = createSpinner(`Esperando a que ${serviceName} acepte conexiones...`).start();

    const { success: psSuccess, out: psOut } = await runCommand(
      'docker', ['compose', 'ps', '-q', serviceName], { cwd: this.canvasDir, captureAll: true }
    );
    
    if (!psSuccess || !psOut.trim()) {
      spinner.error({ text: `No se encontró el contenedor para el servicio ${serviceName}` });
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
        spinner.success({ text: `${serviceName} está listo y aceptando conexiones.`, mark: '  √' });
        return true;
      }

      // --- Detección de corrupción en logs ---
      const corruption = await this._detectCorruption(containerId);
      if (corruption) {
        spinner.warn({ text: `Corrupción detectada en ${serviceName}. Iniciando auto-recuperación...` });
        this.boot.warn(`[AUTO-RECOVERY] Patrón detectado: ${corruption}`);
        
        const recovered = await this._autoRecover(serviceName);
        if (recovered) {
          this.boot.success('[AUTO-RECOVERY] Volumen limpiado y contenedor reiniciado. Reintentando...');
          // Reiniciar el polling con el nuevo contenedor
          return this.waitForPostgres(serviceName, maxAttempts);
        } else {
          spinner.error({ text: 'Auto-recuperación falló. Se requiere intervención manual.' });
          return false;
        }
      }

      // --- Backoff exponencial ---
      spinner.update({
        text: `Esperando a que ${serviceName} acepte conexiones... (intento ${attempt}/${maxAttempts}, próximo en ${(waitMs / 1000).toFixed(0)}s)`
      });
      await new Promise(r => setTimeout(r, waitMs));
      waitMs = Math.min(waitMs * 1.5, MAX_WAIT);
    }

    spinner.error({ text: `${serviceName} no respondió tras ${maxAttempts} intentos.` });
    this.boot.error('PostgreSQL no logró aceptar conexiones. Posibles causas:');
    this.boot.error('  - Docker tiene muy poca RAM asignada y Postgres no logra arrancar.');
    this.boot.error('  - El volumen de datos está dañado (intente: docker compose down -v && docker compose up -d).');
    return false;
  }

  /**
   * Lee los últimos logs del contenedor de Postgres y busca patrones
   * de corrupción irrecuperable (PANIC, FATAL con checkpoint, WAL corruption).
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

  /**
   * Auto-recovery: detiene el stack, destruye volúmenes y reinicia.
   * Esto permite que Postgres arranque desde cero con un volumen limpio.
   */
  async _autoRecover(serviceName) {
    this.boot.warn('[AUTO-RECOVERY] Paso 1/3: Deteniendo stack y destruyendo volúmenes corruptos...');
    const { success: downOk } = await runCommand(
      'docker', ['compose', 'down', '-v'],
      { cwd: this.canvasDir, timeout: 60000 }
    );

    if (!downOk) {
      this.boot.error('[AUTO-RECOVERY] No se pudo detener el stack.');
      return false;
    }

    this.boot.info('[AUTO-RECOVERY] Paso 2/3: Reiniciando stack con volúmenes limpios...');
    const { success: upOk } = await runCommand(
      'docker', ['compose', 'up', '-d'],
      { cwd: this.canvasDir, timeout: 120000 }
    );

    if (!upOk) {
      this.boot.error('[AUTO-RECOVERY] No se pudo reiniciar el stack.');
      return false;
    }

    this.boot.info('[AUTO-RECOVERY] Paso 3/3: Esperando 10s para que Postgres inicie con datos limpios...');
    await new Promise(r => setTimeout(r, 10000));

    return true;
  }

  async checkMigrations() {
    this.boot.info('Verificando estructura de la base de datos...');
    const script = "ActiveRecord::Base.connection.table_exists?('accounts') ? exit(0) : exit(1)";
    const { success } = await runCommand('docker', ['compose', 'exec', '-T', 'web', 'bundle', 'exec', 'rails', 'runner', script], { cwd: this.canvasDir });
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
          spinner.success({ text: 'Migraciones completadas exitosamente.', mark: '  √' });
          resolve(true);
        } else {
          spinner.error({ text: `Falló la ejecución de las migraciones (código ${code})`, mark: '  X' });
          this.boot.error(`Código de salida ${code}. Últimas líneas:\n${tailLines.toString()}`);
          resolve(false);
        }
      });
      
      child.on('error', (err) => {
        spinner.error({ text: 'Fallo al invocar el proceso docker compose', mark: '  !' });
        this.boot.error(err.message);
        resolve(false);
      });
    });
  }
}
