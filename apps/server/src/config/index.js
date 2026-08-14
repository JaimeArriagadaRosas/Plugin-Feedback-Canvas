/**
 * Central configuration layer.
 *
 * Thin proxy over `process.env`. DOES NOT replace `process.env`: centralizes
 * reads for validation, masking, and auditing, while keeping key names,
 * defaults, and the ability to MUTATE `process.env` at runtime (used today
 * by main.js, SystemConfigController, and test setups).
 *
 * Golden rule to avoid breaking anything: any migrated read must preserve
 * the same variable name and the same default value it had.
 */
import logger from '../utils/logger.js';

/** Reads an environment variable, returning `fallback` if absent or empty. */
export function getEnv(key, fallback) {
  // eslint-disable-next-line security/detect-object-injection
  const v = process.env[key];
  return v === undefined || v === '' ? fallback : v;
}

/** Reads an environment boolean ('true' | '1'). */
export function getEnvBool(key, fallback = false) {
  // eslint-disable-next-line security/detect-object-injection
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  return v === 'true' || v === '1';
}

/** Writes an environment variable (preserves mutations at runtime). */
export function setEnv(key, value) {
  if (value === undefined || value === null) {
    // eslint-disable-next-line security/detect-object-injection
    delete process.env[key];
  } else {
    // eslint-disable-next-line security/detect-object-injection
    process.env[key] = String(value);
  }
}

/** Production environment? */
export function isProduction() {
  return process.env.NODE_ENV === 'production';
}

/** Is local data mode enabled (relaxed auth)? */
export function isLocalDataEnabled() {
  return getEnvBool('USE_LOCAL_DATA') || getEnvBool('VITE_USE_LOCAL_DATA');
}

/**
 * Reads a backend key with fallback to its VITE_ equivalent (legacy).
 * Keeps the deprecation warning when the VITE_ key is used.
 */
export function getCanvasEnv(key, viteKey) {
  // eslint-disable-next-line security/detect-object-injection
  const val = process.env[key];
  if (val) return val;

  // eslint-disable-next-line security/detect-object-injection
  const viteVal = process.env[viteKey];
  if (viteVal) {
    logger.warn(`Deprecated environment variable: ${viteKey}. Use ${key} in backend.`);
    return viteVal;
  }
  return undefined;
}
