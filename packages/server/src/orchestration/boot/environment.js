import fs from 'node:fs';
import path from 'node:path';
import { BootResult } from './result.js';

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

const STARTUP_VARS = ['STARTUP_MODE', 'NON_INTERACTIVE', 'USE_LOCAL_DATA', 'VITE_USE_LOCAL_DATA'];

export class EnvironmentDetector {
  constructor(pluginDir) {
    this.pluginDir = pluginDir;
    this.envPath = path.resolve(pluginDir, '.env');
    this.examplePath = path.resolve(pluginDir, 'env_example');
  }

  /** Lee el .env manualmente (sin dotenv) para auditoría. */
  readRawEnv() {
    if (!fs.existsSync(this.envPath)) return {};
    const out = {};
    for (const line of fs.readFileSync(this.envPath, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const idx = t.indexOf('=');
      if (idx > 0) out[t.slice(0, idx)] = t.slice(idx + 1).trim();
    }
    return out;
  }

  /** Asegura que .env exista a partir de env_example. Devuelve BootResult. */
  ensureEnvFile(log) {
    if (fs.existsSync(this.envPath)) {
      log.success('Archivo .env presente.');
      return BootResult.ok({ present: true });
    }
    if (!fs.existsSync(this.examplePath)) {
      log.warn('No existe .env ni env_example; se continuará sin archivo de entorno.');
      return BootResult.warn('Falta .env y env_example', 'Crear .env manualmente con las variables requeridas.');
    }
    fs.copyFileSync(this.examplePath, this.envPath);
    log.auto('Se creó .env a partir de env_example.');
    return BootResult.fixed('Archivo .env creado desde env_example.');
  }

  /** Valida variables críticas según el modo. */
  validate(log, mode) {
    const env = { ...process.env, ...this.readRawEnv() };
    const missing = [];

    for (const { key, desc } of REQUIRED_FOR_LTI) {
      if (!env[key] || !env[key].trim()) missing.push(`${key} (${desc})`);
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
    if (Object.keys(needed).length === 0) return false;

    const lines = fs.existsSync(this.envPath) ? fs.readFileSync(this.envPath, 'utf8').split('\n') : [];
    for (const [k, v] of Object.entries(needed)) lines.push(`${k}=${v}`);
    fs.writeFileSync(this.envPath, lines.join('\n') + '\n', 'utf8');
    return true;
  }
}
