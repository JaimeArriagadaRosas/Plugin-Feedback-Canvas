/**
 * TokenManager.js
 *
 * Central module for managing Canvas API tokens for the local environment.
 *
 * Production strategy applied locally:
 * - Se diferencia entre "Canvas is not ready" (ECONNREFUSED) y "invalid token" (401).
 * - Communication with the Ruby container DOES NOT use stdout/Regex. Instead, the script
 *   de Ruby escribe un archivo JSON en el volumen Docker compartido (/usr/src/app/tmp/)
 *   which Node.js reads and deletes atomically. This is equivalent to the pattern of
 *   "credential handoff via shared volume" usado en pipelines CI/CD modernos.
 * - Se usa reintentos con backoff exponencial para errores de red transitoria.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { runCommand } from './Runner.js';

const CANVAS_LOCAL_URL = 'http://127.0.0.1:8080';
const CANVAS_VALIDATION_ENDPOINT = '/api/v1/users/self/profile';
const CANVAS_PING_ENDPOINT = '/api/v1/brand_variables';
// We use the project root to avoid the 'tmp' folder (which is a separate Docker volume)
// intercepte la escritura y oculte el archivo del host (Path shadowing).
const TOKEN_HANDOFF_PATH_IN_CONTAINER = '/usr/src/app/.token_handoff.json';

// --- Utilidades ---

/**
 * Generic retry utility with exponential backoff.
 * @param {Function} asyncFn - Async function to retry.
 * @param {number} retries - Number of retries.
 * @param {number} baseWaitMs - Espera base en ms (se duplica en cada intento).
 * @param {Function} [onRetry] - Callback opcional llamado antes de cada reintento.
 * @returns {Promise<any>}
 */
export async function withRetry(asyncFn, retries = 3, baseWaitMs = 2000, onRetry = null) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await asyncFn();
    } catch (e) {
      lastError = e;
      if (attempt < retries) {
        const waitMs = baseWaitMs * attempt;
        if (onRetry) onRetry(attempt, retries, waitMs, e);
        await new Promise(r => setTimeout(r, waitMs));
      }
    }
  }
  throw lastError;
}

// --- Canvas Validation ---

/**
 * Checks if the Canvas web server is ready to receive requests.
 * Uses a public endpoint (brand_variables) that does not require authentication.
 *
 * @returns {Promise<{ ready: boolean, error?: string }>}
 */
export async function pingCanvasAPI() {
  try {
    const response = await fetch(`${CANVAS_LOCAL_URL}${CANVAS_PING_ENDPOINT}`, {
      signal: AbortSignal.timeout(8000),
      redirect: 'manual',
      headers: { 'Host': 'localhost:8443', 'X-Forwarded-Proto': 'https' }
    });
    // Canvas may return 401 on this endpoint but at least it is responding.
    return { ready: response.status !== 0 };
  } catch (e) {
    const isNetworkError = e.code === 'ECONNREFUSED' || e.code === 'ECONNRESET' ||
      (e.cause && (e.cause.code === 'ECONNREFUSED' || e.cause.code === 'ECONNRESET')) ||
      e.name === 'AbortError';
    return { ready: false, error: isNetworkError ? 'NETWORK_ERROR' : e.message };
  }
}

/**
 * Validates a Canvas API token by making an authenticated request.
 * Diferencia entre error de red (Canvas no listo) y invalid token (401).
 *
 * @param {string} token
 * @returns {Promise<{ valid: boolean, reason: 'OK'|'UNAUTHORIZED'|'NETWORK_ERROR'|'UNKNOWN', status?: number }>}
 */
export async function validateToken(token) {
  if (!token) return { valid: false, reason: 'NO_TOKEN' };

  try {
    const response = await fetch(`${CANVAS_LOCAL_URL}${CANVAS_VALIDATION_ENDPOINT}`, {
      signal: AbortSignal.timeout(10000),
      redirect: 'manual',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Host': 'localhost:8443',
        'X-Forwarded-Proto': 'https'
      }
    });

    if (response.ok) return { valid: true, reason: 'OK', status: response.status };
    if (response.status === 401) return { valid: false, reason: 'UNAUTHORIZED', status: 401 };
    return { valid: false, reason: 'UNKNOWN', status: response.status };
  } catch (e) {
    return { valid: false, reason: 'NETWORK_ERROR', error: e.message };
  }
}

// --- Token Healing via Docker File (production-safe pattern) ---

/**
 * Regenera el token del profesor en Canvas ejecutando un script de Ruby que
 * escribe el resultado en un archivo JSON dentro del volumen Docker compartido.
 * Node.js reads and deletes the file atomically.
 *
 * This pattern (credential handoff via shared volume) is the industry standard
 * for secure communication between Docker containers and the host, as it prevents
 * exponer tokens en stdout (susceptibles a Warnings de Ruby, logs de CI/CD, etc.).
 *
 * @param {string} canvasDir - Ruta al directorio de Canvas LMS.
 * @param {string} teacherEmail - Email del profesor (CANVAS_TEACHER_EMAIL).
 * @param {string} [fallbackName] - Nombre como fallback si no se encuentra por email.
 * @param {string} [existingToken] - Current token (if it exists) to reuse if valid.
 * @param {boolean} [forceRegenerate=false] - Force regeneration even if the token is valid.
 * @returns {Promise<{ user_id: number, email: string, token: string, canvas_sub: string }>}
 */
export async function healTokenViaFile(canvasDir, teacherEmail, fallbackName = 'Dr. Elena Ramirez', existingToken = null, forceRegenerate = false) {
  const hostHandoffPath = path.join(canvasDir, '.token_handoff.json');

  // Pre-crear el archivo de handoff desde el host y otorgar permisos de escritura
  // so that the unprivileged user of the container can write to it.
  try {
    await fs.writeFile(hostHandoffPath, '');
    await fs.chmod(hostHandoffPath, 0o666);
  } catch (e) {
    console.debug('Could not pre-create the handoff file on the host', e.message);
  }

  const shouldRegenerate = forceRegenerate || !existingToken;

  const rubyScript = `
require 'json'

user = Pseudonym.find_by(unique_id: '${teacherEmail}')&.user
user ||= User.find_by(name: '${fallbackName}')

unless user
  File.write('${TOKEN_HANDOFF_PATH_IN_CONTAINER}', JSON.generate({ error: 'TEACHER_NOT_FOUND', email: '${teacherEmail}', name: '${fallbackName}' }))
  exit 1
end

if ${shouldRegenerate}
  user.access_tokens.where(purpose: 'Local Dev Token').destroy_all
  new_token_record = user.access_tokens.create!(purpose: 'Local Dev Token')
  token_str = new_token_record.full_token
else
  token_str = '${existingToken || ''}'
end

past_ids = begin; user.past_lti_ids.map(&:past_lti_id); rescue; []; end
all_ids = ([(user.respond_to?(:lti_id) ? user.lti_id : nil), user.uuid, user.lti_context_id] + past_ids).compact
uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
lti_sub = all_ids.find { |id| id.to_s.match?(uuid_regex) } || (user.respond_to?(:lti_id) ? user.lti_id : (user.lti_context_id || user.uuid))

result = {
  user_id: user.id,
  email: '${teacherEmail}',
  token: token_str,
  canvas_sub: lti_sub,
  regenerated: ${shouldRegenerate}
}

File.write('${TOKEN_HANDOFF_PATH_IN_CONTAINER}', JSON.generate(result))
`;

  const { success, err } = await runCommand(
    'docker',
    ['compose', 'exec', '-T', '-e', 'DISABLE_SPRING=1', 'web', 'bundle', 'exec', 'rails', 'runner', '-'],
    { cwd: canvasDir, input: rubyScript, timeout: 120000 }
  );

  if (!success) {
    throw new Error(`[TOKEN-MANAGER] Rails runner failed. Stderr: ${err?.slice(0, 500)}`);
  }

  // Leer el archivo de handoff desde el host (volumen compartido)
  // const hostHandoffPath was already declared at the beginning of the function
  let raw;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    raw = await fs.readFile(hostHandoffPath, 'utf-8');
  } catch (e) {
    throw new Error(`[TOKEN-MANAGER] Could not find the handoff file at ${hostHandoffPath}. The Ruby script may have failed silently.`);
  }

  // Delete the file immediately (do not leave tokens on disk longer than necessary)
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  await fs.unlink(hostHandoffPath).catch(e => { console.debug('Error unlinking handoff file', e.message); });

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error(`[TOKEN-MANAGER] The handoff file contains invalid JSON: ${raw.slice(0, 200)}`);
  }

  if (data.error) {
    throw new Error(`[TOKEN-MANAGER] Ruby error: ${data.error} (email: ${data.email}, name: ${data.name})`);
  }

  if (!data.token) {
    throw new Error(`[TOKEN-MANAGER] The handoff file does not contain a token. Data received: ${JSON.stringify(data)}`);
  }

  return data;
}
