import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class SSLConfig {
  static CERTS_DIR = path.resolve(__dirname, '../../certs');
  static CERT_PEM = path.join(this.CERTS_DIR, 'localhost.pem');
  static CERT_KEY = path.join(this.CERTS_DIR, 'localhost-key.pem');

  /**
   * Determina las características de SSL del entorno actual sin mutar variables.
   * @returns {{ isDockerLocal: boolean, isProduction: boolean, certsExist: boolean, httpsRequested: boolean }}
   */
  static getEnvironment() {
    const isDockerLocal = process.env.STARTUP_MODE === '3' ||
                          !!process.env.CANVAS_BASE_URL?.includes('localhost');
    const isProduction = process.env.NODE_ENV === 'production';
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const certsExist = fs.existsSync(this.CERT_PEM) && fs.existsSync(this.CERT_KEY);
    const httpsRequested = process.env.HTTPS !== 'false';

    return {
      isDockerLocal,
      isProduction,
      certsExist,
      httpsRequested
    };
  }

  /**
   * Evalúa si HTTPS debe usarse basado en el entorno (no reescribe .env).
   */
  static shouldUseHttps() {
    const env = this.getEnvironment();
    // HTTPS se usa si no estamos en prod y se solicitó explícitamente o por defecto
    if (env.isProduction) return false; // En prod, SSL se delega al ingress/nginx
    if (!env.httpsRequested) return false;
    return true; // Intentaremos usar HTTPS en dev/docker
  }
}
