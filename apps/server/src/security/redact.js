/**
 * Centralized redactor for secrets and PII in logs.
 *
 * Two mechanisms:
 *  1) redactByKey: Uses key names (paths) so Pino censors
 *     any structured metadata containing a sensitive key, regardless
 *     of depth (**.key).
 *  2) redactSensitiveStrings: Scans strings (messages, URLs) and replaces
 *     any actual secret value that might have leaked accidentally.
 *
 * NOTE: Does not import config/secrets.js to avoid a circular dependency
 * (config/secrets.js -> security/secrets.js -> logger.js -> redact.js).
 */

export const SECRET_ENV_NAMES = [
  'WEBHOOK_SECRET',
  'CANVAS_ACCESS_TOKEN',
  'DB_PASSWORD',
  'ENCRYPTION_KEY',
  'GEMINI_API_KEY',
  'CANVAS_ADMIN_PASS',
  'CANVAS_TEACHER_PASS',
  'CANVAS_STUDENT_PASS',
];

export const REDACT_KEYS = [
  'password', 'password_hash', 'passwordHash',
  'token', 'id_token', 'lti_token', 'access_token', 'refresh_token',
  'secret', 'secretKey', 'apiKey', 'api_key',
  'webhookSecret', 'WEBHOOK_SECRET',
  'canvasAccessToken', 'CANVAS_ACCESS_TOKEN',
  'ENCRYPTION_KEY', 'GEMINI_API_KEY', 'DB_PASSWORD',
  'authorization', 'cookie', 'set-cookie',
  'email', 'personEmail', 'person_email', 'name', 'name', 'given_name', 'family_name',
  'devToken', 'dev-token', 'dev-role', 'dev_role',
  'state', 'nonce', 'lti_message_hint', 'sf_verifier',
  ...SECRET_ENV_NAMES,
];

const CENSORED = '[REDACTED]';

export function redactByKey(key, value) {
  if (value === undefined || value === null) return value;
  const k = typeof key === 'string' ? key.toLowerCase() : '';
  const hit = REDACT_KEYS.some((rk) => {
    const r = rk.toLowerCase();
    return k === r || k.endsWith('.' + r);
  });
  return hit ? CENSORED : value;
}

export function redactSensitiveStrings(input) {
  if (typeof input !== 'string') return input;
  let out = input;
  for (const name of SECRET_ENV_NAMES) {
    // eslint-disable-next-line security/detect-object-injection
    const val = process.env[name];
    if (val && val.length > 8) {
      out = out.split(val).join(CENSORED);
    }
  }

  // Redact sensitive query parameters in URLs or strings that look like query params
  const sensitiveParams = ['code', 'state', 'access_token', 'refresh_token', 'id_token', 'token', 'sf_verifier'];
  for (const param of sensitiveParams) {
    // eslint-disable-next-line security/detect-non-literal-regexp
    const regex = new RegExp(`([?&]|^)(${param}=)([^&\\s]+)`, 'gi');
    out = out.replace(regex, `$1$2${CENSORED}`);
  }

  return out;
}

export const REDACT_PATHS = REDACT_KEYS.flatMap((k) => [k, `*.${k}`, `**.${k}`]);
