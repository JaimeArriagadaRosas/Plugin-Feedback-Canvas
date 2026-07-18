/**
 * Redactor centralizado de secretos y PII para los logs.
 *
 * Dos mecanismos:
 *  1) redactByKey: usa los NOMBRES de clave (paths) para que Pino censure
 *     cualquier meta estructurada que contenga una clave sensible, sin
 *     importar la profundidad (**.clave).
 *  2) redactSensitiveStrings: escanea strings (mensajes, URLs) y reemplaza
 *     cualquier valor real de secreto que se haya filtrado accidentalmente.
 *
 * NOTA: no importa config/secrets.js para evitar un ciclo de imports
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
  'email', 'personEmail', 'person_email',
  'devToken', 'dev-token', 'dev-role', 'dev_role',
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
    const val = process.env[name];
    if (val && val.length > 8) {
      out = out.split(val).join(CENSORED);
    }
  }
  return out;
}

export const REDACT_PATHS = REDACT_KEYS.flatMap((k) => [k, `*.${k}`, `**.${k}`]);
