/**
 * SystemTokenManager.js
 *
 * Single responsible for managing the system API token for the local environment.
 *
 * Strategy applied:
 * - Tracks Canvas container changes using .canvas_container_id.
 * - If the container changed (recreated), regenerates the token directly via Docker handoff.
 * - If the container is unchanged, validates the existing token (1 attempt, no retries).
 * - Fast Boot: reuses token immediately without HTTP validation.
 * - The token is ONLY saved to .env. It is an infrastructure token, not a user token.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { getCanvasDirectory, getPluginDirectory } from '../installation/utils/LocalWorkspacePaths.js';
import { validateToken, healTokenViaFile, withRetry } from '../installation/utils/TokenManager.js';
import { safeUpdateEnvVariable } from '../installation/utils/FileManager.js';
import { runCommand } from '../installation/utils/Runner.js';

const CANVAS_DIR = getCanvasDirectory();
const PLUGIN_ENV_PATH = path.join(getPluginDirectory(), '.env');

export class SystemTokenManager {
  static async _getCanvasContainerId() {
    try {
      const { success, out } = await runCommand('docker', [
        'compose', 'ps', '-q', 'web'
      ], { cwd: CANVAS_DIR, captureAll: true });
      return success && out ? out.trim().slice(0, 12) : null;
    } catch {
      return null;
    }
  }

  static async _hasCanvasContainerChanged() {
    const currentId = await this._getCanvasContainerId();
    if (!currentId) return null; // Can't determine
    
    const fingerPrintPath = path.join(getPluginDirectory(), '.canvas_container_id');
    try {
      const savedId = (await fs.readFile(fingerPrintPath, 'utf-8')).trim();
      const changed = savedId !== currentId;
      if (changed) {
        await fs.writeFile(fingerPrintPath, currentId, 'utf-8');
      }
      return changed;
    } catch {
      await fs.writeFile(fingerPrintPath, currentId, 'utf-8');
      return true; // First time → treat as changed
    }
  }

  static async generate(spinner) {
    const log = (msg) => { if (spinner) spinner.clear(); console.log(`  · ${msg}`); };
    const warn = (msg) => { if (spinner) spinner.clear(); console.log(`  ! ${msg}`); };
    const error = (msg) => { if (spinner) spinner.clear(); console.log(`  × ${msg}`); };

    try {
      if (spinner) spinner.update({ text: 'Verifying system API token...' });

      const systemEmail = process.env.CANVAS_SYSTEM_EMAIL || 'system@canvas.local';
      const systemFallbackName = 'Plugin System Account';
      const existingToken = process.env.CANVAS_ACCESS_TOKEN || null;

      let tokenData = null;

      // Fast Boot: skip validation entirely
      if (process.env.FAST_BOOT === 'true' && existingToken) {
        log('Fast Boot: reusing existing system token.');
        tokenData = { token: existingToken, reused: true, fastBoot: true };
      }

      if (!tokenData) {
        const containerChanged = await this._hasCanvasContainerChanged();
        
        if (containerChanged === true) {
          log('Canvas container changed since last boot.');
          tokenData = await this._regenerateToken(systemEmail, systemFallbackName, existingToken, spinner, log, warn);
        } else if (containerChanged === false) {
          // Changed = false, so we validate but without retries
          tokenData = await this._validateExistingToken(existingToken, systemEmail, spinner, log, warn, false);
        } else {
          // Fallback if we couldn't determine container change
          tokenData = await this._validateExistingToken(existingToken, systemEmail, spinner, log, warn, true);
        }

        // If validation failed, regenerate
        if (!tokenData) {
          tokenData = await this._regenerateToken(systemEmail, systemFallbackName, existingToken, spinner, log, warn);
        }
      }

      if (spinner) {
        spinner.success({ text: 'System token ready.', mark: '  √' });
      }

    } catch (e) {
      error(`Fatal error managing system token: ${e.message}`);
      if (spinner) {
        spinner.warn({ text: `Warning: Could not manage system token. Error: ${e.message}`, mark: '  !' });
      } else {
        console.log(`  ! Warning: Could not manage system token. Error: ${e.message}`);
      }
    }
  }

  static async _validateExistingToken(existingToken, systemEmail, spinner, log, warn, withRetries = false) {
    if (!existingToken) {
      log(`No existing token found. Generating for the first time...`);
      return null;
    }

    log(`Validating existing token for ${systemEmail}...`);
    
    let validation;
    if (withRetries) {
      validation = await withRetry(
        () => validateToken(existingToken),
        3, 2000,
        (attempt, total, waitMs) => {
          if (spinner) spinner.update({ text: `Verifying token... (attempt ${attempt}/${total})` });
          log(`Retrying token validation in ${waitMs}ms (attempt ${attempt}/${total})`);
        }
      ).catch(e => ({ valid: false, reason: 'NETWORK_ERROR', error: e.message }));
    } else {
      // No retries
      try {
        validation = await validateToken(existingToken);
      } catch (e) {
        validation = { valid: false, reason: 'NETWORK_ERROR', error: e.message };
      }
    }

    if (validation.reason === 'NETWORK_ERROR') {
      warn(`Canvas is not responding (${validation.error}). Assuming existing token is valid.`);
      return { token: existingToken, canvas_sub: null, user_id: null, reused: true, networkError: true };
    } else if (validation.valid) {
      log(`Existing system token is valid.`);
      return { token: existingToken, canvas_sub: null, user_id: null, reused: true };
    }
    
    log(`Existing token expired. Regenerating...`);
    return null;
  }

  static async _regenerateToken(systemEmail, systemFallbackName, existingToken, spinner, log, warn) {
    if (spinner) spinner.update({ text: 'Generating system token...' });

    const healed = await healTokenViaFile(
      CANVAS_DIR, systemEmail, systemFallbackName, existingToken, true
    );

    await safeUpdateEnvVariable(PLUGIN_ENV_PATH, 'CANVAS_ACCESS_TOKEN', healed.token, warn);
    process.env.CANVAS_ACCESS_TOKEN = healed.token;
    
    log(`System token generated via Docker handoff.`);
    log(`System token saved to .env`);
    
    return healed;
  }
}
