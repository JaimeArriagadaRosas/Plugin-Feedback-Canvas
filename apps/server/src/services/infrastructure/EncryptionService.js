import crypto from 'crypto';
import dotenv from 'dotenv';
import { getSecret } from '../../config/secrets.js';
import logger from '../../utils/logger.js';

dotenv.config({ quiet: true });

const ALGORITHM = 'aes-256-gcm';
// B6 FIX: NIST SP 800-38D recommends 12-byte (96 bits) IV for AES-GCM.
// Using 16 bytes works but is suboptimal (requires additional GHASH operations).
const IV_LENGTH = 12;
const EXPECTED_KEY_HEX_LENGTH = 64;

let cachedKey = null;

function getKey() {
  if (cachedKey) return cachedKey;
  
  const KEY_HEX = getSecret('ENCRYPTION_KEY');
  if (!KEY_HEX || KEY_HEX.length !== EXPECTED_KEY_HEX_LENGTH) {
    throw new Error(`ENCRYPTION_KEY is required and must be ${EXPECTED_KEY_HEX_LENGTH} characters (hex). The KeyManager should have generated it. Received: ${KEY_HEX ? KEY_HEX.length : 0}`);
  }

  try {
    const KEY = Buffer.from(KEY_HEX, 'hex');
    if (KEY.length !== 32) throw new Error('Incorrect buffer length');
    cachedKey = KEY;
    return cachedKey;
  } catch (e) {
    throw new Error('ENCRYPTION_KEY contains invalid hexadecimal characters.');
  }
}

/**
 * Encryption Service (AES-256-GCM)
 * Ensures API credentials are not stored in plain text.
 */
export default class EncryptionService {
  /**
   * Encrypts plain text
   */
  static encrypt(text) {
    const KEY = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    // Return IV + Tag + Encrypted Text
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypts cipher text
   */
  static decrypt(encryptedData) {
    try {
      const [ivHex, authTagHex, encryptedHex] = encryptedData.split(':');
      
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const KEY = getKey();
      const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
      
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error('Failed to decrypt data. The key may be incorrect or the data might be corrupted.');
    }
  }

  /**
   * Safely decrypts cipher text, catching exceptions and logging them.
   * Returns null if decryption fails.
   */
  static safeDecrypt(encryptedData, context = 'Unknown data', quiet = false) {
    if (!encryptedData) return null;
    try {
      return this.decrypt(encryptedData);
    } catch (error) {
      if (!quiet) {
        logger.error(`[EncryptionService] Failed to decrypt for: ${context}. Possible ENCRYPTION_KEY change or corrupted data.`);
      }
      return null;
    }
  }
}
