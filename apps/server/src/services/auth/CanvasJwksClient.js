import jwksClient from 'jwks-rsa';
import https from 'https';
import logger from '../../utils/logger.js';

class CanvasJwksClient {
  constructor() {
    const baseUrl = process.env.CANVAS_BASE_URL || 'https://canvas.instructure.com';
    this.jwksUri = `${baseUrl}/api/lti/security/jwks`;
    const isLocal = this.jwksUri.includes('localhost') || process.env.STARTUP_MODE === '3';
    
    logger.info('[JWKS-CLIENT] JWKS client initialized', { jwksUri: this.jwksUri, isLocal });
    
    this.client = jwksClient({
      jwksUri: this.jwksUri,
      requestAgent: isLocal ? new https.Agent({ rejectUnauthorized: false }) : undefined,
      cache: true,
      cacheMaxAge: 86400000,  // 24 hours in ms
      rateLimit: true,
      jwksRequestsPerMinute: 10,
      timeout: 20000,
      requestHeaders: {},
      getKeysInterceptor: undefined
    });
  }

  async getPublicKey(header) {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      attempt++;
      try {
        return await new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error(`Timeout waiting for JWKS key for kid=${header?.kid} (${this.jwksUri})`));
          }, 25000);
          
          this.client.getSigningKey(header.kid, (err, key) => {
            clearTimeout(timer);
            if (err) reject(err);
            else resolve(key.getPublicKey());
          });
        });
      } catch (error) {
        if (attempt >= maxRetries) {
          logger.error(`[JWKS-CLIENT] getPublicKey definitely failed after ${maxRetries} attempts: ${error.message}`);
          throw error;
        }
        logger.warn(`[JWKS-CLIENT] Failed to fetch JWKS (attempt ${attempt}/${maxRetries}): ${error.message}. Retrying shortly...`);
        await new Promise(r => setTimeout(r, 2000 * attempt));
      }
    }
  }
}

let _sharedClient = null;
export function getJwksClient() {
  if (!_sharedClient) {
    _sharedClient = new CanvasJwksClient();
  }
  return _sharedClient;
}
