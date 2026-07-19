import fs from 'node:fs';
import path from 'node:path';
import { runCommand } from './utils/Runner.js';
import { createSpinner } from 'nanospinner';
import { VerifyData } from './VerifyData.js';
import { DataSeeder } from './DataSeeder.js';
import { DatabaseHealth } from './DatabaseHealth.js';
import { LtiBootstrap } from '../lti.js';

export class PostflightSetup {
  constructor(boot, pluginDir, canvasDir) {
    this.boot = boot;
    this.pluginDir = pluginDir;
    this.canvasDir = canvasDir;
    this.envFile = path.join(this.pluginDir, '.env');
  }

  async runChecks() {
    this.boot.info('Iniciando verificación post-arranque de la Universidad y el plugin LTI');

    const verifier = new VerifyData(this.boot, this.canvasDir);
    const seeder = new DataSeeder(this.boot, this.pluginDir, this.canvasDir);

    const hasData = await verifier.isDataPopulated();

    if (!hasData) {
      this.boot.warn('Faltan los datos base de la Universidad. Intentando inyectar datos...');
      const dbHealth = new DatabaseHealth(this.boot, this.canvasDir);
      await dbHealth.ensureDatabaseReady();
      
      const seeded = await seeder.seedData();
      if (!seeded) {
        this.boot.error('No se pudieron inyectar los datos base automáticamente.');
        return false;
      }
      
      const hasDataAfter = await verifier.isDataPopulated(1, 1);
      if (!hasDataAfter) {
        this.boot.error('La verificación final de datos falló incluso después de inyectar.');
        return false;
      }
    } else {
      this.boot.info('Datos base de la Universidad validados.');
    }

    await this.healTeacherToken();
    
    this.boot.info('Ejecutando verificación LTI final...');
    const ltiBoot = new LtiBootstrap({ mode: '3', log: this.boot });
    const ltiRes = await ltiBoot.run();
    if (!ltiRes.success && !ltiRes?.data?.skipped) {
      this.boot.error('Verificación LTI falló en el Postflight.');
      return false;
    }
    
    this.boot.info('Verificación post-arranque exitosa.');
    return true;
  }

  async healTeacherToken() {
    const spinner = createSpinner('Verificando validez del token de Canvas...').start();
    
    let currentToken = null;
    if (fs.existsSync(this.envFile)) {
      const content = fs.readFileSync(this.envFile, 'utf-8');
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.startsWith('CANVAS_ACCESS_TOKEN=')) {
          currentToken = line.split('=')[1].trim();
          break;
        }
      }
    }

    if (currentToken) {
      try {
        const response = await fetch('http://127.0.0.1:8080/api/v1/users/self/profile', {
          headers: {
            'Authorization': `Bearer ${currentToken}`,
            'Host': 'localhost:8443',
            'X-Forwarded-Proto': 'https'
          }
        });
        if (response.ok) {
          spinner.success({ text: 'Token de API Canvas validado.' });
          return;
        }
      } catch (e) {
        // Just fallback to healing
      }
    }

    spinner.update({ text: 'Token inválido o ausente. Regenerando...' });

    const rubyScript = `
teacher = User.find_by(workflow_state: 'registered', name: 'Dr. Elena Ramirez')
unless teacher
  puts 'ERROR: Teacher not found'
  exit 1
end
teacher.access_tokens.where(purpose: 'Local Dev Token').destroy_all
token = teacher.access_tokens.create!(purpose: 'Local Dev Token')
puts "NEW_TOKEN:#{token.full_token}"
`;

    const { success, out, err } = await runCommand('docker', ['compose', 'exec', '-T', 'web', 'bundle', 'exec', 'rails', 'runner', rubyScript], { cwd: this.canvasDir });
    
    if (!success) {
      spinner.error({ text: 'Error al regenerar token con rails runner.' });
      this.boot.error(`Rails runner error: ${err}`);
      return;
    }

    const match = out.match(/NEW_TOKEN:([^\\s\\r\\n]+)/);
    if (!match) {
      spinner.error({ text: 'No se encontró NEW_TOKEN en la salida.' });
      return;
    }

    const newToken = match[1].trim();

    // Update .env
    let envContent = fs.existsSync(this.envFile) ? fs.readFileSync(this.envFile, 'utf-8') : '';
    const lines = envContent.split('\n');
    let updated = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('CANVAS_ACCESS_TOKEN=')) {
        lines[i] = `CANVAS_ACCESS_TOKEN=${newToken}`;
        updated = true;
        break;
      }
    }
    if (!updated) lines.push(`CANVAS_ACCESS_TOKEN=${newToken}`);
    fs.writeFileSync(this.envFile, lines.join('\n') + (lines[lines.length - 1] === '' ? '' : '\n'));

    spinner.success({ text: 'Token de API Canvas auto-sanado y guardado.' });

    // Sync in perfiles_data.json
    const syncScript = `
import json
try:
    with open('/usr/src/app/tmp/perfiles_data.json', 'r') as f:
        data = json.load(f)
    for u in data.get('usuarios', []):
        if u.get('rol') == 'teacher':
            u['token'] = '${newToken}'
    with open('/usr/src/app/tmp/perfiles_data.json', 'w') as f:
        json.dump(data, f)
except Exception:
    pass
`;
    await runCommand('docker', ['compose', 'exec', '-T', 'web', 'python3', '-c', syncScript], { cwd: this.canvasDir });
  }
}
