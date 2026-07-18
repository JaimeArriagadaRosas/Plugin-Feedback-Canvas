import logger from '../utils/logger.js';
import { isProduction } from './envGuard.js';

/**
 * Validación de secretos al arranque.
 *
 * Detecta secretosPlaceholder por defecto o débiles y advierte/ Bloquea en
 * producción. No rota secretos reales (eso es responsabilidad del operador),
 * pero evita despliegues con valores de ejemplo.
 */

const PLACEHOLDER_PATTERNS = [
  'change_me',
  'changeme',
  'your_api_key_here',
  'your-key-here',
  'example',
  'TODO',
  'XXXX',
];

export function isPlaceholderSecret(value) {
  if (!value) return true;
  const v = String(value).toLowerCase();
  return PLACEHOLDER_PATTERNS.some((p) => v.includes(p));
}

/**
 * Valida los secretos críticos. Lanza en producción si alguno es placeholder.
 */
export function validateSecretsOrThrow(secrets = {}) {
  const problems = [];
  for (const [name, value] of Object.entries(secrets)) {
    if (isPlaceholderSecret(value)) {
      problems.push(name);
      console.warn(`[SECURITY] Secreto ${name} parece ser un placeholder.`, {
        value: value ? String(value).substring(0, 6) + '...' : 'vacío',
      });
    }
  }
  if (problems.length && isProduction()) {
    throw new Error(
      `Secretos no configurados correctamente en producción: ${problems.join(', ')}`
    );
  }
  return problems;
}
