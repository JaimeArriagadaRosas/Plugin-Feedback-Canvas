/**
 * TokenManager.js
 *
 * Central Canvas API token management module for the local environment.
 * 
 * Production strategy applied locally:
 * - It differentiates between 'Canvas is not ready' (ECONNREFUSED) and 'invalid token' (401).
 * - Communication with the Ruby container does NOT use stdout/Regex. Instead, the script
 *   writes a JSON file in the shared Docker volume (/usr/src/app/tmp/)
 *   which Node.js reads and atomically deletes. This is equivalent to the pattern of
 *   "credential handoff via shared volume" used in modern CI/CD pipelines.
 * - It uses retries with exponential backoff for transient network errors.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { runCommand } from './Runner.js';

const CANVAS_LOCAL_URL = 'http://127.0.0.1:8080';
const CANVAS_VALIDATION_ENDPOINT = '/api/v1/users/self/profile';
const CANVAS_PING_ENDPOINT = '/api/v1/brand_variables';
// We use the root of the project to prevent the 'tmp' folder (which is a separate Docker volume) 
// from intercepting the write and hiding the file from the host (Path shadowing).
const TOKEN_HANDOFF_PATH_IN_CONTAINER = '/usr/src/app/.token_handoff.json';

// --- Utilities ---

/**
 * Generic retry utility with exponential backoff.
 * @param {Function} asyncFn - Async function to retry.
 * @param {number} retries - Number of retries.
 * @param {number} baseWaitMs - Base wait in ms (doubles on each attempt).
 * @param {Function} [onRetry] - Optional callback called before each retry.
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
 * Differentiates between network error (Canvas not ready) and invalid token (401).
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
 * Regenerates the teacher's token in Canvas by executing a Ruby script that
 * writes the result in a JSON file inside the shared Docker volume.
 * Node.js reads and atomically deletes the file.
 *
 * This pattern (credential handoff via shared volume) is the industry standard
 * for secure communication between Docker containers and the host, as it prevents
 * exposing tokens in stdout (susceptible to Ruby Warnings, CI/CD logs, etc.).
 *
 * @param {string} canvasDir - Path to the Canvas LMS directory.
 * @param {string} teacherEmail - Teacher's email (CANVAS_TEACHER_EMAIL).
 * @param {string} [fallbackName] - Fallback name if not found by email.
 * @param {string} [existingToken] - Current token (if it exists) to reuse if valid.
 * @param {boolean} [forceRegenerate=false] - Force regeneration even if token is valid.
 * @returns {Promise<{ user_id: number, email: string, token: string, canvas_sub: string }>}
 */
export async function healTokenViaFile(canvasDir, teacherEmail, fallbackName = 'Dr. Elena Ramirez', existingToken = null, forceRegenerate = false) {
  // Clean up previous handoff file if it exists (in case the previous process failed halfway)
  const cleanupScript = `File.delete('${TOKEN_HANDOFF_PATH_IN_CONTAINER}') rescue nil`;
  await runCommand('docker', ['compose', 'exec', '-T', 'web', 'bundle', 'exec', 'rails', 'runner', cleanupScript], { cwd: canvasDir });

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

  // Read the handoff file from the host (shared volume)
  const hostHandoffPath = path.join(canvasDir, '.token_handoff.json');
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
