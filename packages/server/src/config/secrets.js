import { getEnv, isProduction } from './index.js';
import crypto from 'node:crypto';

/**
 * Registro declarativo de secretos.
 *
 * Centraliza qué secretos existen, su criticidad y si son requeridos, para
 * validarlos en un único punto (fail-closed en producción) en lugar de tener
 * listas hardcodeadas dispersas (antes en bootstrap.js y EncryptionService).
 *
 *  - required: true  -> en producción, ausencia o placeholder LANZA.
 *  - required: false -> en producción, la ausencia se permite pero el placeholder
 *                       sigue detectándose y LANZA (conserva el comportamiento previo
 *                       de WEBHOOK_SECRET / CANVAS_ACCESS_TOKEN / DB_PASSWORD).
 */
export const SECRET_REGISTRY = {
  WEBHOOK_SECRET:       { required: false, critical: true },
  CANVAS_ACCESS_TOKEN:  { required: false, critical: true },
  DB_PASSWORD:          { required: true,  critical: true },
  ENCRYPTION_KEY:       { required: true,  critical: true }, // antes validado aparte en EncryptionService
  DEV_TOKEN_SECRET:     { required: true,  critical: true },
  CANVAS_ADMIN_PASS:    { required: false, critical: true },
  CANVAS_TEACHER_PASS:  { required: false, critical: true },
  CANVAS_STUDENT_PASS:  { required: false, critical: true },
};

const PLACEHOLDER_PATTERNS = [
  'change_me',
  'changeme',
  'your_api_key_here',
  'your-key-here',
  'example',
  'TODO',
  'XXXX',
];

/** Enmascara un secreto para logs: muestra solo los últimos 4 caracteres. */
export function maskSecret(value) {
  if (value === undefined || value === null || value === '') return '<vacío>';
  const s = String(value);
  if (s.length <= 4) return '****';
  return '****' + s.slice(-4);
}

function isPlaceholderSecret(value) {
  if (!value) return true;
  const v = String(value).toLowerCase();
  return PLACEHOLDER_PATTERNS.some(p => v.includes(p));
}

function estimateEntropy(value) {
  if (!value) return 0;
  const len = value.length;
  const unique = new Set(value).size;
  return unique * Math.log2(len || 1);
}

/**
 * Valida los secretos del registro.
 * Devuelve la lista de problemas en cualquier entorno; en producción LANZA si
 * hay alguno. En no-producción solo advierte (no rompe el arranque/local/test).
 */
export function validateSecretsOrThrow(registry = SECRET_REGISTRY) {
  const problems = [];

  for (const [name, cfg] of Object.entries(registry)) {
    const value = getEnv(name);
    if (!value) {
      if (cfg.required) problems.push(name);
      continue;
    }
    if (isPlaceholderSecret(value)) {
      problems.push(name);
    }
    if (name === 'ENCRYPTION_KEY' && estimateEntropy(value) < 90) {
      problems.push(`${name} (entropía insuficiente)`);
    }
  }

  for (const name of problems) {
    console.warn(`[SECURITY] Secreto ${name} parece ser un placeholder o falta.`, {
      valor: maskSecret(getEnv(name.split(' ')[0])),
    });
  }

  if (problems.length && isProduction()) {
    throw new Error(
      `Secretos no configurados correctamente en producción: ${problems.join(', ')}`
    );
  }

  return problems;
}

/** Lee un secreto de forma centralizada (proxy sobre process.env). */
export function getSecret(name) {
  return getEnv(name);
}
