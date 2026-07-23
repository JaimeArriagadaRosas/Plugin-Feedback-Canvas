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
    if (fs.existsSync(caPath)) {
      cachedCaBuffer = fs.readFileSync(caPath);
      logger.info(`[TLS] Se cargó el rootCA de mkcert exitosamente desde AppData.`);
      return cachedCaBuffer;
    } else {
       logger.warn(`[TLS] No se encontró rootCA.pem en ${caRoot}`);
    }
  } catch (error) {
    logger.warn(`[TLS] No se pudo obtener el rootCA de mkcert. Error: ${error.message}`);
  }
  return null;
}

export function configureLocalTLS() {
  // La inyección dinámica de NODE_EXTRA_CA_CERTS ya no se usa porque Undici/fetch no la toma en runtime.
  // El certificado se inyecta directamente mediante dispatcher en el CanvasClient.
}
