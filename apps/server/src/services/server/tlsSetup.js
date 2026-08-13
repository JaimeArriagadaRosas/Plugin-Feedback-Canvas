import fs from 'node:fs';
import http from 'node:http';
import { SSLService } from '../../security/SSLService.js';
import { isHttpsEnabled, getSslCertPaths } from '../../security/envGuard.js';
import logger from '../../utils/logger.js';

export async function generateLtiKeys() {
  const { generateKeyPairSync } = await import('node:crypto');
  const { publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicExponent: 0x10001
  });

  const publicKeyJwk = publicKey.export({ format: 'jwk' });

  const ltiPublicJwk = {
    ...publicKeyJwk,
    alg: 'RS256',
    use: 'sig',
    kid: `lti-key-${Date.now()}`
  };
  logger.info('[LTI] Par de claves LTI generado exitosamente.', { kid: ltiPublicJwk.kid });
  return ltiPublicJwk;
}

export async function createServerInstance(app) {
  logger.info(`[HTTPS] Esquema de transporte configurado (STARTUP_MODE: ${process.env.STARTUP_MODE ?? '(indefinido)'}).`);
  logger.debug(`[HTTPS] HTTPS env flag : ${process.env.HTTPS ?? '(indefinido / auto-detección)'}`);
  logger.debug(`[HTTPS] NODE_ENV       : ${process.env.NODE_ENV ?? '(indefinido)'}`);

  const sslContext = await SSLService.initializeSSLContext();
  const shouldUseHttps = isHttpsEnabled();
  const { cert, key } = getSslCertPaths();
  
  logger.debug(`[HTTPS] Entorno SSL detectado : ${JSON.stringify(sslContext.env)}`);
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  logger.debug(`[HTTPS] Certificado (pem)    : ${cert} -> ${fs.existsSync(cert) ? 'ENCONTRADO' : 'AUSENTE'}`);
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  logger.debug(`[HTTPS] Clave privada (key)  : ${key} -> ${fs.existsSync(key) ? 'ENCONTRADA' : 'AUSENTE'}`);
  logger.debug(`[HTTPS] DECISIÓN FINAL       : ${shouldUseHttps ? 'HTTPS (TLS)' : 'HTTP (plano)'}`);

  if (shouldUseHttps) {
    const https = await import('node:https');
    let sslOptions;
    try {
      sslOptions = {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        key:  fs.readFileSync(key),
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        cert: fs.readFileSync(cert),
      };
      logger.info('[HTTPS] Certificados leídos correctamente. Creando servidor TLS...');
    } catch (err) {
      logger.error(`[HTTPS] ERROR al leer los certificados SSL: ${err.message}`);
      logger.error('[HTTPS] No se puede arrancar en HTTPS. Revise los archivos en apps/server/certs/.');
      throw err;
    }
    return https.default.createServer(sslOptions, app);
  } else {
    return http.createServer(app);
  }
}
