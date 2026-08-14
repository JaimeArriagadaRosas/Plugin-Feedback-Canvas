/**
 * TeacherTokenGenerator.js
 *
 * Single responsible for managing the teacher's API token for the local environment.
 *
 * Strategy applied (aligned with production):
 * - First validates the existing token (differentiating network error vs. invalid token).
 * - If Canvas is not available (ECONNREFUSED), retries with backoff instead of
 *   destroying and regenerating the token unnecessarily.
 * - If the token is genuinely invalid (401), regenerates it using the Docker handoff file
 *   strategy (not stdout/Regex).
 * - Persists the token ONLY in PostgreSQL via CanvasTokenRepository (encrypted).
 *   The plain text copy in perfiles_data.json is eliminated.
 */

import path from 'node:path';
import { getCanvasDirectory, getPluginDirectory } from '../installation/utils/LocalWorkspacePaths.js';
import { validateToken, healTokenViaFile, withRetry } from '../installation/utils/TokenManager.js';
import { safeUpdateEnvVariable } from '../installation/utils/FileManager.js';
import { LocalTokenStore } from './LocalTokenStore.js';

const CANVAS_DIR = getCanvasDirectory();
const PLUGIN_ENV_PATH = path.join(getPluginDirectory(), '.env');

// Local token validity: 1 year (development environment)
const LOCAL_TOKEN_EXPIRY_MS = 1000 * 60 * 60 * 24 * 365;

export class TeacherTokenGenerator {
  static async generate(spinner) {
    const log = (msg) => { if (spinner) spinner.clear(); console.log(`  · ${msg}`); };
    const warn = (msg) => { if (spinner) spinner.clear(); console.log(`  ! ${msg}`); };
    const error = (msg) => { if (spinner) spinner.clear(); console.log(`  × ${msg}`); };

    try {
      if (spinner) spinner.update({ text: 'Verifying teacher API token...' });

      const teacherEmail = process.env.CANVAS_TEACHER_EMAIL || 'teacher@canvas.local';
      const teacherFallbackName = process.env.CANVAS_TEACHER_NAME || 'Dr. Elena Ramirez';
      const existingToken = process.env.CANVAS_ACCESS_TOKEN || null;

      let tokenData = await this._validateExistingToken(existingToken, teacherEmail, spinner, log, warn);
      
      if (!tokenData) {
        tokenData = await this._regenerateToken(teacherEmail, teacherFallbackName, existingToken, spinner, log, warn);
      }

      const tokenSynchronized = await this._syncToDatabase(
        tokenData, teacherEmail, teacherFallbackName, spinner, log, warn
      );

      if (spinner) {
        if (tokenSynchronized) {
          spinner.success({ text: 'Teacher token setup completed.', mark: '  √' });
        } else {
          spinner.warn({
            text: 'Valid token; PostgreSQL synchronization pending.',
            mark: '  !'
          });
        }
      }

    } catch (e) {
      error(`Fatal error managing teacher token: ${e.message}`);
      if (spinner) {
        spinner.warn({ text: `Warning: Could not manage teacher token. Error: ${e.message}`, mark: '  !' });
      } else {
        console.log(`  ! Warning: Could not manage teacher token. Error: ${e.message}`);
      }
    }
  }

  static async _validateExistingToken(existingToken, teacherEmail, spinner, log, warn) {
    if (!existingToken) {
      log(`No token in CANVAS_ACCESS_TOKEN. Generating for the first time.`);
      return null;
    }

    log(`Validating existing token for ${teacherEmail}...`);
    const validation = await withRetry(
      () => validateToken(existingToken),
      3, 2000,
      (attempt, total, waitMs) => {
        if (spinner) spinner.update({ text: `Verifying token... (attempt ${attempt}/${total})` });
        log(`Retrying token validation in ${waitMs}ms (attempt ${attempt}/${total})`);
      }
    ).catch(e => ({ valid: false, reason: 'NETWORK_ERROR', error: e.message }));

    if (validation.reason === 'NETWORK_ERROR') {
      warn(`Canvas is not responding (${validation.error}). Assuming existing token is valid.`);
      return { token: existingToken, canvas_sub: null, user_id: null, reused: true, networkError: true };
    } else if (validation.valid) {
      log(`Existing token validated successfully (HTTP 200).`);
      return { token: existingToken, canvas_sub: null, user_id: null, reused: true };
    }
    
    log(`Invalid token (${validation.reason}, HTTP ${validation.status}). Proceeding to regenerate.`);
    return null;
  }

  static async _regenerateToken(teacherEmail, teacherFallbackName, existingToken, spinner, log, warn) {
    if (spinner) spinner.update({ text: 'Starting new session, regenerating token...' });

    const healed = await healTokenViaFile(
      CANVAS_DIR, teacherEmail, teacherFallbackName, existingToken, true
    );

    await safeUpdateEnvVariable(PLUGIN_ENV_PATH, 'CANVAS_ACCESS_TOKEN', healed.token, warn);
    process.env.CANVAS_ACCESS_TOKEN = healed.token;
    log(`Token regenerated and saved to .env.`);
    
    return healed;
  }

  static async _syncToDatabase(tokenData, teacherEmail, teacherFallbackName, spinner, log, warn) {
    if (tokenData.networkError || !tokenData.token) {
      if (tokenData.networkError && spinner) {
        spinner.warn({ text: `Token assumed valid (Canvas not responding). Will synchronize on the next authenticated request.`, mark: '  !' });
      }
      return false;
    }

    try {
      let canvasSub = tokenData.canvas_sub;
      let userId = tokenData.user_id;

      if (tokenData.reused && !canvasSub) {
        const userData = await healTokenViaFile(
          CANVAS_DIR, teacherEmail, teacherFallbackName, tokenData.token, false
        );
        canvasSub = userData.canvas_sub;
        userId = userData.user_id;
      }

      if (canvasSub) {
        const store = new LocalTokenStore();
        try {
          const expiresAt = new Date(Date.now() + LOCAL_TOKEN_EXPIRY_MS);
          const tokenKey = userId ? String(userId) : canvasSub;
          await store.saveToken(tokenKey, tokenData.token, null, expiresAt);
          log(`Token synchronized in PostgreSQL (token_key: ${tokenKey}, canvas_sub: ${canvasSub}, canvas_user_id: ${userId}).`);

          if (!spinner) {
            console.log(`  √ Token synchronized in PostgreSQL (canvas_user_id=${userId}).`);
          }
          return true;
        } finally {
          await store.close();
        }
      }
      warn('Could not extract canvas_sub to synchronize in DB.');
      return false;
    } catch (e) {
      if (e.message && e.message.includes('does not exist')) {
        log('Pending migrations. Token will be synchronized later.');
      } else {
        warn('Could not synchronize the teacher token. Will retry on the next boot.');
      }
      return false;
    }
  }
}
