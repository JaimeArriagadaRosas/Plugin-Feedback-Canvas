import { runCommand } from './utils/Runner.js';
import { createSpinner } from 'nanospinner';
import fs from 'node:fs';
import path from 'node:path';

export class DataSeeder {
  constructor(boot, pluginDir, canvasDir) {
    this.boot = boot;
    this.pluginDir = pluginDir;
    this.canvasDir = canvasDir;
    this.seedFile = path.join(this.pluginDir, 'db', 'seeds', 'local_data.rb');
    this.envFile = path.join(this.pluginDir, '.env');
  }

  async seedData() {
    this.boot.plain('');
    this.boot.plain('── ▶ Inicializando datos de prueba en Canvas LMS ───────────');

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const runnerFile = path.join(this.pluginDir, 'db', 'seeds', 'runner.rb');
    if (!fs.existsSync(runnerFile)) {
      this.boot.error(`No se encontró el script de semilla principal: ${runnerFile}`);
      return false;
    }

    this.boot.info('Inyectando usuarios y cursos de prueba en Canvas...');

    // spawn needs to feed stdin
    // We can use a trick with cross-spawn or just child_process directly since we need to write to stdin
    const { spawn, execSync } = await import('node:child_process');
    
    try {
      this.boot.info('Copiando directorio de semillas al contenedor Canvas...');
      const seedsDir = path.join(this.pluginDir, 'db', 'seeds');
      // Copiar la carpeta seeds entera al directorio temporal del contenedor web
      execSync(`docker compose cp "${seedsDir}" web:/tmp/seeds`, { cwd: this.canvasDir, stdio: 'ignore' });
    } catch (e) {
      this.boot.warn(`No se pudo copiar el directorio de semillas al contenedor: ${e.message}. El script podría fallar.`);
    }

    const { TailBuffer } = await import('./utils/Runner.js');
    const spinner = createSpinner('Inyectando datos de prueba (esto tomará un par de minutos)...').start();

    return new Promise((resolve) => {
      // Execute the runner.rb file located in /tmp/seeds/runner.rb
      const child = spawn('docker', ['compose', 'exec', '-i', 'web', 'bundle', 'exec', 'rails', 'runner', '/tmp/seeds/runner.rb'], {
        cwd: this.canvasDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const tailLines = new TailBuffer(50);

      const timeoutId = setTimeout(() => {
        spinner.error({ text: 'Tiempo de espera agotado al inyectar datos (10 min).' });
        this.boot.error('El subproceso se colgó o falló silenciosamente. Abortando.');
        child.kill('SIGKILL');
        resolve(false);
      }, 600000); // 10 minutos de timeout

      child.stdout.on('data', (data) => tailLines.push(data.toString()));
      child.stderr.on('data', (data) => tailLines.push(data.toString()));

      child.on('close', (code) => {
        clearTimeout(timeoutId);
        if (code === 0) {
          spinner.success({ text: '¡Base de datos poblada exitosamente!', mark: '  √' });
          this._syncCanvasToken(tailLines.toString()).then(() => resolve(true)).catch(() => resolve(true));
        } else {
          spinner.error({ text: 'Error al ejecutar el script de semilla.', mark: '  ×' });
          this.boot.error(`Código de salida ${code}. Últimas líneas:\n${tailLines.toString()}`);
          resolve(false);
        }
      });

      child.on('error', (err) => {
        clearTimeout(timeoutId);
        spinner.error({ text: 'Fallo al iniciar inyección de datos.' });
        this.boot.error(`Error al iniciar proceso docker compose: ${err.message}`);
        resolve(false);
      });
    });
  }

  async _syncCanvasToken(seedOutput) {
    // Independientemente de si vimos el token en stdout o no,
    // necesitamos extraer el JSON completo del contenedor para sincronizar 
    // TODOS los usuarios (UUIDs de estudiantes) en nuestra base de datos local.
    this.boot.info('Extrayendo perfiles y tokens completos desde el contenedor de Canvas...');
    await this._syncTokenFromContainer();
  }

  async _syncTokenFromContainer() {
    const { success, out } = await runCommand('docker', ['compose', 'exec', '-T', 'web', 'cat', '/usr/src/app/tmp/perfiles_data.json'], { cwd: this.canvasDir, captureAll: true });
    
    if (success && out.trim()) {
      try {
        const perfiles = JSON.parse(out);

        // Guardar localmente para que el middleware (CanvasOAuthMiddleware) pueda leerlo
        // y mapear los UUIDs de LTI a los tokens correspondientes en STARTUP_MODE=3
        const localPath = path.join(this.pluginDir, 'tmp', 'canvas_local_users.json');
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        if (!fs.existsSync(path.dirname(localPath))) {
          // eslint-disable-next-line security/detect-non-literal-fs-filename
          fs.mkdirSync(path.dirname(localPath), { recursive: true });
        }
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        fs.writeFileSync(localPath, JSON.stringify(perfiles, null, 2));
        this.boot.info(`Usuarios y tokens exportados a ${localPath}`);

        const teacher = perfiles.usuarios?.find(u => u.rol === 'teacher');
        if (teacher && teacher.token) {
          this._writeTokenToEnv(teacher.token);
        } else {
          this.boot.warn('No se encontró token de profesor en perfiles_data.json');
        }

        // --- SINCRONIZAR BASE DE DATOS LOCAL DEL PLUGIN ---
        const seedPath = path.join(this.pluginDir, 'db', 'seeds', 'seedLocalUsers.js');
        const { success: seedSuccess, out: seedOut } = await runCommand('node', [seedPath, localPath], { cwd: this.pluginDir });
        if (seedSuccess) {
          this.boot.info('Usuarios locales (estudiantes/profesor) sincronizados con éxito en la BD PostgreSQL del plugin.');
        } else {
          // Limpiar el spam extrayendo solo el error relevante (últimas lineas)
          const cleanOut = seedOut.split('\n').filter(l => l.trim().length > 0).slice(-3).join('\n    ');
          this.boot.error('Error al sincronizar usuarios locales en la BD del plugin:\n    ' + cleanOut);
        }
      } catch (e) {
        this.boot.warn('Error parseando perfiles_data.json: ' + e.message);
      }
    }
  }

  _writeTokenToEnv(token) {
    let content = '';
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (fs.existsSync(this.envFile)) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      content = fs.readFileSync(this.envFile, 'utf-8');
    }
    
    const lines = content.split('\n');
    let updated = false;
    
    for (let i = 0; i < lines.length; i++) {
      // eslint-disable-next-line security/detect-object-injection
      if (lines[i].startsWith('CANVAS_ACCESS_TOKEN=')) {
        // eslint-disable-next-line security/detect-object-injection
        lines[i] = `CANVAS_ACCESS_TOKEN=${token}`;
        updated = true;
        break;
      }
    }

    if (!updated) {
      lines.push(`CANVAS_ACCESS_TOKEN=${token}`);
    }

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.writeFileSync(this.envFile, lines.join('\n') + (lines[lines.length - 1] === '' ? '' : '\n'));
    this.boot.info('CANVAS_ACCESS_TOKEN actualizado en .env correctamente.');
  }
}
