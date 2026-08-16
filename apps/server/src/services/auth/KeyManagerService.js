import { generateKeyPairSync } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import logger from '../../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CERTS_DIR = path.resolve(__dirname, '..', '..', '..', 'certs');
const KEYS_FILE = path.join(CERTS_DIR, 'session_keys.json');

export default class KeyManagerService {
  constructor() {
    this._privateKeyPem = null;
    this._publicKeyPem = null;
  }

  ensureKeys() {
    if (this._privateKeyPem && this._publicKeyPem) {
      return { privateKeyPem: this._privateKeyPem, publicKeyPem: this._publicKeyPem };
    }

    if (fs.existsSync(KEYS_FILE)) {
      try {
        const data = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf-8'));
        if (data.privateKeyPem && data.publicKeyPem) {
          this._privateKeyPem = data.privateKeyPem;
          this._publicKeyPem = data.publicKeyPem;
          logger.info('[KeyManager] Session RSA keys successfully loaded from disk.');
          return { privateKeyPem: this._privateKeyPem, publicKeyPem: this._publicKeyPem };
        }
      } catch (e) {
        logger.warn(`[KeyManager] Could not read RSA keys from ${KEYS_FILE}: ${e.message}`);
      }
    }

    logger.info('[KeyManager] Generating new RSA key pair for session_token...');
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicExponent: 0x10001,
    });

    this._privateKeyPem = privateKey.export({ format: 'pem', type: 'pkcs1' });
    this._publicKeyPem = publicKey.export({ format: 'pem', type: 'spki' });

    try {
      if (!fs.existsSync(CERTS_DIR)) {
        fs.mkdirSync(CERTS_DIR, { recursive: true });
      }
      fs.writeFileSync(KEYS_FILE, JSON.stringify({
        privateKeyPem: this._privateKeyPem,
        publicKeyPem: this._publicKeyPem,
        createdAt: new Date().toISOString()
      }, null, 2), { mode: 0o600 });
      logger.info(`[KeyManager] New RSA keys generated and saved in ${KEYS_FILE}`);
    } catch (e) {
      logger.error(`[KeyManager] Error saving RSA keys to disk: ${e.message}`);
    }

    return { privateKeyPem: this._privateKeyPem, publicKeyPem: this._publicKeyPem };
  }
}

export const keyManagerService = new KeyManagerService();
