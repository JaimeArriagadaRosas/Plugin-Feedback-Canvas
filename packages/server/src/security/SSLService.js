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
    logger.info('[SSLService] JWKS cache bust timestamp set', { timestamp });
  }

  /**
   * Punto de entrada principal para el arranque SSL.
   * Reemplaza el antiguo SSLCertificateManager.init().
   * @returns {Promise<{ isHttps: boolean, env: object }>}
   */
  static async initializeSSLContext() {
    const env = SSLConfig.getEnvironment();
    logger.info('[SSLService] Inicializando contexto SSL de forma inmutable', { httpsRequested: env.httpsRequested });

    let isHttps = false;

    if (SSLConfig.shouldUseHttps()) {
      logger.info('[SSLService] HTTPS solicitado. Verificando/generando certificados con mkcert...');
      const certsReady = await SSLCertificateGenerator.ensureCertificates();
      
      if (certsReady) {
        isHttps = true;
        // Mensaje requerido: Configuración de dispositivo / entorno
        console.info('');
        console.info('===============================================================');
        console.info('🛡️  VERIFICACIÓN: Autoconfiguración HTTPS Completada');
        console.info('   -> El dispositivo está adaptado y chequeado para TLS.');
        console.info('   -> Esquema activo: HTTPS Seguro (mkcert).');
        console.info('===============================================================');
        console.info('');
      } else {
        logger.warn('[SSLService] No se pudieron asegurar los certificados. Fallback a HTTP plano (inseguro para LTI).');
      }
    } else {
      logger.info('[SSLService] HTTPS no solicitado o es Producción. Usando HTTP.');
    }

    this.bustJwksCache();
    
    // Setear isHttps global efímero para envGuard y otras dependencias que leen runtime
    process.env._RUNTIME_IS_HTTPS = isHttps ? 'true' : 'false';

    return { isHttps, env };
  }
}
