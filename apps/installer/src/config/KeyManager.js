import crypto from 'crypto';
import { getEnvVar, updateEnvVars } from '../orchestration/envWriter.js';

export default class KeyManager {
  /**
   * Ensures that encryption keys (ENCRYPTION_KEY, WEBHOOK_SECRET)
   * exist and are cryptographically secure. If they are not, generates new ones and
   * injects them into the .env file automatically.
   * @param {string} pluginDir Root directory where .env is located
   * @param {object} log Logging interface (optional)
   */
  static ensureKeys(pluginDir, log) {
    const EXPECTED_KEY_HEX_LENGTH = 64; // 32 bytes en hex
    const keysToValidate = ['ENCRYPTION_KEY', 'WEBHOOK_SECRET', 'DEV_TOKEN_SECRET'];
    const keysToUpdate = {};
    let needsUpdate = false;

    for (const key of keysToValidate) {
      // Read directly from .env and environment variables
      // eslint-disable-next-line security/detect-object-injection
      const currentValue = process.env[key] || getEnvVar(pluginDir, key);
      
      // Validate if the key is missing or if it is a placeholder (e.g. "your_encryption_key_here")
      // or if its length is invalid.
      if (!currentValue || currentValue.length !== EXPECTED_KEY_HEX_LENGTH || currentValue.includes('your_')) {
        const newKey = crypto.randomBytes(32).toString('hex');
        // eslint-disable-next-line security/detect-object-injection
        keysToUpdate[key] = newKey;
        // eslint-disable-next-line security/detect-object-injection
        process.env[key] = newKey; // Update memory too
        needsUpdate = true;
        
        if (log && log.warn) {
          log.warn(`Key ${key} missing, insecure, or invalid length. A new key has been auto-generated.`);
        }
      }
    }

    if (needsUpdate) {
      process.env.KEYS_REGENERATED = 'true';
      updateEnvVars(pluginDir, keysToUpdate);
      if (log && log.success) {
        log.success('Secure cryptographic keys successfully saved in .env.');
      }
    } else {
      if (log && log.info) {
        log.info('The existing cryptographic keys (ENCRYPTION_KEY, WEBHOOK_SECRET) are valid.');
      }
    }
  }
}
