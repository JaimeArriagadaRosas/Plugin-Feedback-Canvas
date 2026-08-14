import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import logger from '../utils/logger.js';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let cachedCaBuffer = null;

export function getLocalCaBuffer() {
  if (cachedCaBuffer) return cachedCaBuffer;
  const isDev = process.env.NODE_ENV !== 'production' || process.env.STARTUP_MODE === '3';
  if (!isDev) return null;

  try {
    const caRoot = execFileSync('mkcert', ['-CAROOT'], { encoding: 'utf-8' }).trim();
    const caPath = path.join(caRoot, 'rootCA.pem');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (fs.existsSync(caPath)) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      cachedCaBuffer = fs.readFileSync(caPath);
      logger.info(`[TLS] mkcert rootCA successfully loaded from AppData.`);
      return cachedCaBuffer;
    } else {
       logger.warn(`[TLS] rootCA.pem not found in ${caRoot}`);
    }
  } catch (error) {
    logger.warn(`[TLS] Could not get mkcert rootCA. Error: ${error.message}`);
  }
  return null;
}

export function configureLocalTLS() {
  // Dynamic injection of NODE_EXTRA_CA_CERTS is no longer used because Undici/fetch does not take it at runtime.
  // The certificate is injected directly via dispatcher in CanvasClient.
}
