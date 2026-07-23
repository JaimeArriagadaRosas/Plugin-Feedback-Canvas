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
    this.boot.info('=========================================================');
    this.boot.info('   INICIALIZANDO DATOS DE PRUEBA EN CANVAS LMS');
    this.boot.info('=========================================================');

    if (!fs.existsSync(this.seedFile)) {
      this.boot.error(`No se encontró el script de semilla: ${this.seedFile}`);
      return false;
    }

    let scriptContent;
    try {
      scriptContent = fs.readFileSync(this.seedFile, 'utf-8');
    } catch (e) {
      this.boot.error(`Error al leer el script de semilla: ${e.message}`);
      return false;
    }

    this.boot.info('Inyectando usuarios y cursos de prueba en Canvas...');
    const spinner = createSpinner('Inyectando datos de prueba (esto tomará un par de minutos)...').start();

    // spawn needs to feed stdin
    // We can use a trick with cross-spawn or just child_process directly since we need to write to stdin
    const { spawn } = await import('node:child_process');
    
    return new Promise((resolve) => {
      const child = spawn('docker', ['compose', 'exec', '-i', 'web', 'bundle', 'exec', 'rails', 'runner', '-'], {
        cwd: this.canvasDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdoutStr = '';
      let stderrStr = '';

      const timeoutId = setTimeout(() => {
        spinner.error({ text: 'Tiempo de espera agotado al inyectar datos (10 min).' });
        this.boot.error('El subproceso se colgó o falló silenciosamente. Abortando.');
        child.kill('SIGKILL');
        resolve(false);
      }, 600000); // 10 minutos de timeout

      child.stdout.on('data', (data) => stdoutStr += data.toString());
      child.stderr.on('data', (data) => stderrStr += data.toString());

      child.on('close', (code) => {
        clearTimeout(timeoutId);
        if (code === 0) {
          spinner.success({ text: '¡Base de datos poblada exitosamente!' });
          this.boot.info(stdoutStr);
          this._syncCanvasToken(stdoutStr).then(() => resolve(true)).catch(() => resolve(true));
        } else {
          spinner.error({ text: 'Error al ejecutar el script de semilla.' });
          this.boot.error(`Código de salida ${code}. Salida:\n${stdoutStr}\n${stderrStr}`);
          resolve(false);
        }
      });

      child.on('error', (err) => {
        clearTimeout(timeoutId);
        spinner.error({ text: 'Fallo al iniciar inyección de datos.' });
        this.boot.error(`Error al iniciar proceso docker compose: ${err.message}`);
        resolve(false);
      });

      // Write script to stdin and close it
      child.stdin.write(scriptContent);
      child.stdin.end();
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
    const { success, out } = await runCommand('docker', ['compose', 'exec', '-T', 'web', 'cat', '/usr/src/app/tmp/perfiles_data.json'], { cwd: this.canvasDir });
    
    if (success && out.trim()) {
      try {
        const perfiles = JSON.parse(out);

        // Guardar localmente para que el middleware (CanvasOAuthMiddleware) pueda leerlo
        // y mapear los UUIDs de LTI a los tokens correspondientes en STARTUP_MODE=3
        const localPath = path.join(this.pluginDir, 'tmp', 'canvas_local_users.json');
        if (!fs.existsSync(path.dirname(localPath))) {
          fs.mkdirSync(path.dirname(localPath), { recursive: true });
        }
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
          this.boot.error('Error al sincronizar usuarios locales en la BD del plugin: ' + seedOut);
        }
      } catch (e) {
        this.boot.warn('Error parseando perfiles_data.json: ' + e.message);
      }
    }
  }

  _writeTokenToEnv(token) {
    let content = '';
    if (fs.existsSync(this.envFile)) {
      content = fs.readFileSync(this.envFile, 'utf-8');
    }
    
    const lines = content.split('\n');
    let updated = false;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('CANVAS_ACCESS_TOKEN=')) {
        lines[i] = `CANVAS_ACCESS_TOKEN=${token}`;
        updated = true;
        break;
      }
    }

    if (!updated) {
      lines.push(`CANVAS_ACCESS_TOKEN=${token}`);
    }

    fs.writeFileSync(this.envFile, lines.join('\n') + (lines[lines.length - 1] === '' ? '' : '\n'));
    this.boot.info('CANVAS_ACCESS_TOKEN actualizado en .env correctamente.');
  }
}
