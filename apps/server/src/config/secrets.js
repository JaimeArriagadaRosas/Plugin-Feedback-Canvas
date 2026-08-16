import { getEnv, isProduction } from './index.js';
import logger from '../utils/logger.js';

/**
 * Declarative secrets registry.
 *
 * Centralizes what secrets exist, their criticality, and if they are required,
 * to validate them in a single point (fail-closed in production) instead of having
 * scattered hardcoded lists (previously in bootstrap.js and EncryptionService).
 *
 *  - required: true  -> in production, absence or placeholder THROWS.
 *  - required: false -> in production, absence is allowed but the placeholder
 *                       is still detected and THROWS (preserves previous behavior
 *                       of WEBHOOK_SECRET / CANVAS_ACCESS_TOKEN / DB_PASSWORD).
 */
export const SECRET_REGISTRY = {
  WEBHOOK_SECRET:       { required: false, critical: true },
  CANVAS_ACCESS_TOKEN:  { required: false, critical: true },
  DB_PASSWORD:          { required: true,  critical: true },
  ENCRYPTION_KEY:       { required: true,  critical: true }, // previously validated separately in EncryptionService
  DEV_TOKEN_SECRET:     { required: true,  critical: true },
  LTI_CLIENT_SECRET:    { required: false, critical: true }, // Optional but critical if OAuth2 is used
  CANVAS_CLIENT_SECRET: { required: false, critical: true }, // Alias / alternative for OAuth2
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

/** Masks a secret for logs: shows only the last 4 characters. */
export function maskSecret(value) {
  if (value === undefined || value === null || value === '') return '<empty>';
  const s = String(value);
  if (s.length <= 4) return '****';
  return '****' + s.slice(-4);
}

export function isPlaceholderSecret(value) {
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
 * Validates registry secrets.
 * Returns the list of problems in any environment; in production THROWS if
 * there are any. In non-production only warns (does not break boot/local/test).
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
      problems.push(`${name} (insufficient entropy)`);
    }
  }

  if (problems.length) {
    const list = problems.map(p => p.split(' ')[0]).join(', ');
    logger.warn(`[SECURITY] ⚠️ Secrets using placeholders or insecure values:`, { details: list });
  }

  if (problems.length && isProduction()) {
    throw new Error(
      `Secrets not configured correctly in production: ${problems.join(', ')}`
    );
  }

  return problems;
}

/** Reads a secret centrally (proxy over process.env). */
export function getSecret(name) {
  return getEnv(name);
}
