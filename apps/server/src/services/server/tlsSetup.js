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
  logger.info('[LTI] LTI key pair generated successfully.', { kid: ltiPublicJwk.kid });
  return ltiPublicJwk;
}

export async function createServerInstance(app) {
  logger.info(`[HTTPS] Transport scheme configured (STARTUP_MODE: ${process.env.STARTUP_MODE ?? '(undefined)'}).`);
  logger.debug(`[HTTPS] HTTPS env flag : ${process.env.HTTPS ?? '(undefined / auto-detection)'}`);
  logger.debug(`[HTTPS] NODE_ENV       : ${process.env.NODE_ENV ?? '(undefined)'}`);

  const sslContext = await SSLService.initializeSSLContext();
  const shouldUseHttps = isHttpsEnabled();
  const { cert, key } = getSslCertPaths();
  
  logger.debug(`[HTTPS] SSL environment detected : ${JSON.stringify(sslContext.env)}`);
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  logger.debug(`[HTTPS] Certificate (pem)    : ${cert} -> ${fs.existsSync(cert) ? 'FOUND' : 'MISSING'}`);
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  logger.debug(`[HTTPS] Private key (key)    : ${key} -> ${fs.existsSync(key) ? 'FOUND' : 'MISSING'}`);
  logger.debug(`[HTTPS] FINAL DECISION       : ${shouldUseHttps ? 'HTTPS (TLS)' : 'HTTP (plain)'}`);

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
      logger.info('[HTTPS] Certificates read successfully. Creating TLS server...');
    } catch (err) {
      logger.error(`[HTTPS] ERROR reading SSL certificates: ${err.message}`);
      logger.error('[HTTPS] Cannot start in HTTPS. Check the files in apps/server/certs/.');
      throw err;
    }
    return https.default.createServer(sslOptions, app);
  } else {
    return http.createServer(app);
  }
}
