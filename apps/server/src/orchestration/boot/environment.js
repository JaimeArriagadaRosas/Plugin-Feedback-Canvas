import fs from 'node:fs';
import path from 'node:path';
import { BootResult } from './result.js';
import KeyManager from '../../services/infrastructure/KeyManager.js';

/**
 * EnvironmentDetector — Detección y validación de configuración de entorno.
 *
 * SRP: solo se preocupa de variables de entorno y del archivo .env.
 *  - Detecta si .env existe y lo crea desde env_example si hace falta.
 *  - Valida variables críticas según el modo de arranque.
 *  - Reporta cada problema con su solución exacta.
 */

const REQUIRED_FOR_LTI = [
  { key: 'CANVAS_BASE_URL', desc: 'URL base de Canvas LMS' },
  { key: 'LTI_CLIENT_ID', desc: 'Client ID del tool LTI' },
  { key: 'GEMINI_API_KEY', desc: 'Clave de API de Gemini IA' },
];



export class EnvironmentDetector {
  constructor(pluginDir) {
    this.pluginDir = pluginDir;
    this.envPath = path.resolve(pluginDir, '.env');
    this.examplePath = path.resolve(pluginDir, '.env.example');
  }

  /** Lee el .env manualmente (sin dotenv) para auditoría. */
  readRawEnv() {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!fs.existsSync(this.envPath)) return {};
    const out = {};
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    for (const line of fs.readFileSync(this.envPath, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const idx = t.indexOf('=');
      if (idx > 0) out[t.slice(0, idx)] = t.slice(idx + 1).trim();
    }
    return out;
  }

  /** Asegura que .env exista a partir de .env.example o de un fallback nativo. Devuelve BootResult. */
  ensureEnvFile(log) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (fs.existsSync(this.envPath)) {
      log.success('Archivo .env presente.');
      return BootResult.ok({ present: true });
    }
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (fs.existsSync(this.examplePath)) {
      fs.copyFileSync(this.examplePath, this.envPath);
      log.auto('Se creó .env a partir de .env.example.');
      return BootResult.fixed('Archivo .env creado desde .env.example.');
    }
    
    // Fallback absoluto: Crear archivo base de memoria si no hay nada.
    const fallbackEnv = `# Plugin Feedback - Autogenerado\n
CANVAS_BASE_URL=https://localhost:8443
CANVAS_ISSUER=https://localhost:8443
CANVAS_ACCESS_TOKEN=
DB_HOST=127.0.0.1
DB_USER=postgres
DB_PASSWORD=CHANGE_ME_db_password_strong
DB_NAME=feedback_plugin_db
DB_PORT=5432
ENCRYPTION_KEY=
WEBHOOK_SECRET=
DEV_TOKEN_SECRET=
LTI_DEPLOYMENT_IDS=
GEMINI_API_KEY=YOUR_API_KEY_HERE
CANVAS_COURSE_ID=1
CANVAS_API_HOST=canvas.local
# semgrep-ignore
CANVAS_ADMIN_PASS=password123
# semgrep-ignore
CANVAS_TEACHER_PASS=password123
# semgrep-ignore
CANVAS_STUDENT_PASS=password123
LOCAL_DEV_PASSWORD_HASH=
LTI_CLIENT_ID=
LTI_CLIENT_SECRET=
USE_LOCAL_DATA=false
VITE_USE_LOCAL_DATA=false
`;
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.writeFileSync(this.envPath, fallbackEnv, 'utf8');
    log.auto('Se creó .env a partir de plantilla de seguridad (Fallback en memoria).');
    return BootResult.fixed('Archivo .env creado desde plantilla nativa.');
  }

  /** Valida variables críticas según el modo. */
  validate(log, mode) {
    KeyManager.ensureKeys(this.pluginDir, log);

    const env = { ...process.env, ...this.readRawEnv() };
    const missing = [];

    for (const { key, desc } of REQUIRED_FOR_LTI) {
      // eslint-disable-next-line security/detect-object-injection
      if (!env[key] || !env[key].trim()) {
        if (mode === '3' && key === 'LTI_CLIENT_ID') {
          log.info(`Falta variable: LTI_CLIENT_ID (Se generará e inyectará automáticamente en breve)`);
        } else {
          missing.push(`${key} (${desc})`);
        }
      }
    }

    // STARTUP_MODE es definido por el orquestador, pero es bueno que exista en .env
    // para arranques no interactivos reproducibles. No es crítico si falta.
    if (mode === '2' && (!env.CANVAS_ACCESS_TOKEN || !env.CANVAS_ACCESS_TOKEN.trim())) {
      missing.push('CANVAS_ACCESS_TOKEN (requerido en modo API)');
    }

    if (missing.length) {
      for (const m of missing) log.warn(`Falta variable: ${m}`);
      return BootResult.fail(
        false,
        `${missing.length} variable(s) de entorno faltante(s)`,
        `Agregue al .env: ${missing.join(', ')}`
      );
    }
    log.success('Variables de entorno críticas presentes.');
    return BootResult.ok();
  }

  /** Asegura que las variables de control de arranque existan con defaults sanos. */
  ensureStartupVars(mode) {
    const env = this.readRawEnv();
    const needed = {};
    if (env.STARTUP_MODE === undefined) needed.STARTUP_MODE = mode || '3';
    if (env.NON_INTERACTIVE === undefined) needed.NON_INTERACTIVE = 'false';
    if (env.USE_LOCAL_DATA === undefined) needed.USE_LOCAL_DATA = 'false';
    if (env.VITE_USE_LOCAL_DATA === undefined) needed.VITE_USE_LOCAL_DATA = 'false';
    
    if (mode === '3' && env.CANVAS_BASE_URL === undefined) {
      needed.CANVAS_BASE_URL = 'https://localhost:8443';
    }
    if (Object.keys(needed).length === 0) return false;

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const lines = fs.existsSync(this.envPath) ? fs.readFileSync(this.envPath, 'utf8').split('\n') : [];
    for (const [k, v] of Object.entries(needed)) lines.push(`${k}=${v}`);
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.writeFileSync(this.envPath, lines.join('\n') + '\n', 'utf8');
    return true;
  }
}
