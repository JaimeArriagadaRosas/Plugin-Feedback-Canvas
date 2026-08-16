import { isProduction } from '../config/index.js';
export { isProduction };
import { SSLConfig } from './SSLConfig.js';

/**
 * Returns true if we should use HTTPS in this local environment.
 * In production (isProduction=true) returns false (it is assumed that an ingress/proxy
 * will handle SSL and Express will listen on HTTP).
 */
export function isHttpsEnabled() {
  if (isProduction()) return false;
  // We use the immutable flag set by SSLService at startup
  return process.env._RUNTIME_IS_HTTPS === 'true';
}

/** Absolute path to the plugin's local SSL certificates. */
export function getSslCertPaths() {
  return {
    cert: SSLConfig.CERT_PEM,
    key: SSLConfig.CERT_KEY,
  };
}

export function localDataEnabled() {
  return (
    process.env.USE_LOCAL_DATA === 'true' ||
    process.env.VITE_USE_LOCAL_DATA === 'true'
  );
}

/**
 * Is local mode allowed (relaxed auth + in-memory data)?
 * In production always returns false (fail-closed).
 */
export function isLocalModeAllowed() {
  if (!localDataEnabled()) return false;
  if (isProduction()) {
    console.error(
      '[SECURITY] USE_LOCAL_DATA active in production. Local mode BLOCKED (fail-closed).'
    );
    return false;
  }
  return true;
}

/**
 * Throws if critical environment variables are missing in production.
 * Returns the list of missing variables in other environments (for warning).
 */
export function requireSecretsOrThrow(required = []) {
  // eslint-disable-next-line security/detect-object-injection
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length && isProduction()) {
    throw new Error(
      `Required environment variables missing in production: ${missing.join(', ')}`
    );
  }
  return missing;
}
