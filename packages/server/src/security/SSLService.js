import logger from '../utils/logger.js';
import { SSLConfig } from './SSLConfig.js';
import { SSLCertificateGenerator } from './SSLCertificateGenerator.js';

export class SSLService {
  /**
   * Fuerza que el JWKS client de LTITokenService invalide su caché.
   * Usando memoria/env efímero, en vez de mutar .env.
   */
  static bustJwksCache() {
    const timestamp = Date.now();
    process.env.LTI_JWKS_CACHE_BUST = String(timestamp);
    logger.info('[SSL] JWKS cache bust timestamp set', { timestamp });
  }

  /**
   * Punto de entrada principal para el arranque SSL.
   * Reemplaza el antiguo SSLCertificateManager.init().
   * @returns {Promise<{ isHttps: boolean, env: object }>}
   */
  static async initializeSSLContext() {
    const env = SSLConfig.getEnvironment();
    logger.info('[SSL] Inicializando contexto inmutable para certificados.', { httpsRequested: env.httpsRequested });

    let isHttps = false;

    if (SSLConfig.shouldUseHttps()) {
      logger.info('[SSL] Verificando/generando certificados con mkcert...');
      const certsReady = await SSLCertificateGenerator.ensureCertificates();
      
      if (certsReady) {
        isHttps = true;
        // Mensaje requerido: Configuración de dispositivo / entorno
        logger.info('[SSL] ✅ Autoconfiguración HTTPS Completada (mkcert local).');
      } else {
        logger.warn('[SSL] No se pudieron asegurar los certificados. Fallback a HTTP plano (inseguro para LTI).');
      }
    } else {
      logger.info('[SSL] HTTPS no solicitado o es Producción. Usando HTTP.');
    }

    this.bustJwksCache();
    
    // Setear isHttps global efímero para envGuard y otras dependencias que leen runtime
    process.env._RUNTIME_IS_HTTPS = isHttps ? 'true' : 'false';

    return { isHttps, env };
  }
}
