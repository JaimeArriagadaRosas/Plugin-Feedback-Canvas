import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import https from 'https';
import { AppError } from '../../utils/errors.js';
import logger from '../../utils/logger.js';
import LtiOidcRecoveryManager from '../../middlewares/LtiOidcRecoveryManager.js';


export default class LTITokenService {
  constructor() {
    const baseUrl = process.env.CANVAS_BASE_URL || 'https://canvas.instructure.com';
    this.jwksUri = `${baseUrl}/api/lti/security/jwks`;
    const isLocal = this.jwksUri.includes('localhost') || process.env.STARTUP_MODE === '3';
    logger.info('[LTI-TOKEN] Cliente JWKS inicializado', { jwksUri: this.jwksUri, isLocal });
    
    this.client = jwksClient({
      jwksUri: this.jwksUri,
      requestAgent: isLocal ? new https.Agent({ rejectUnauthorized: false }) : undefined,
      // M8: Caché de 24h para evitar una request HTTP al endpoint JWKS en cada autenticación.
      cache: true,
      cacheMaxAge: 86400000,  // 24 horas en ms
      rateLimit: true,
      jwksRequestsPerMinute: 10,
      // Timeout de red: si el JWKS de Canvas no responde, jwks-rsa debe fallar
      // rápido en vez de colgar la promesa. Aumentado a 20s para entornos Docker lentos.
      timeout: 20000,
      requestHeaders: {},
      getKeysInterceptor: undefined
    });
    this.allowedDeploymentIds = (process.env.LTI_DEPLOYMENT_IDS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }

  async decodePayload(token) {
    try {
      return jwt.decode(token, { complete: false });
    } catch {
      return null;
    }
  }

  async getPublicKey(header) {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      attempt++;
      try {
        return await new Promise((resolve, reject) => {
          // Timeout de contingencia (ligeramente superior al timeout de jwks-rsa)
          const timer = setTimeout(() => {
            reject(new Error(`Timeout esperando clave JWKS para kid=${header?.kid} (${this.jwksUri})`));
          }, 25000);
          this.client.getSigningKey(header.kid, (err, key) => {
            clearTimeout(timer);
            if (err) reject(err);
            else resolve(key.getPublicKey());
          });
        });
      } catch (error) {
        if (attempt >= maxRetries) {
          logger.error(`[LTI-TOKEN] getPublicKey falló definitivamente tras ${maxRetries} intentos: ${error.message}`);
          throw error;
        }
        logger.warn(`[LTI-TOKEN] Fallo obteniendo JWKS (intento ${attempt}/${maxRetries}): ${error.message}. Reintentando en breve...`);
        // Backoff: 2s, 4s...
        await new Promise(r => setTimeout(r, 2000 * attempt));
      }
    }
  }

  async verifyToken(token) {
    try {
      const decodedHeader = jwt.decode(token, { complete: true })?.header;
      if (!decodedHeader) throw new AppError('Token mal formado', 401);

      logger.info(`[LTI-TOKEN] verifyToken: header del id_token | alg="${decodedHeader.alg}" kid="${decodedHeader.kid}" jwksUri="${this.jwksUri}"`);
      logger.info('[LTI-TOKEN] verifyToken: solicitando clave publica a JWKS...');
      const publicKey = await this.getPublicKey(decodedHeader);
      logger.info('[LTI-TOKEN] verifyToken: clave publica obtenida del JWKS (OK)');
      
      const baseUrl = process.env.CANVAS_BASE_URL || 'https://canvas.instructure.com';
      const expectedIssuer = process.env.CANVAS_ISSUER || baseUrl;

      const decoded = jwt.verify(token, publicKey, {
        algorithms: ['RS256'],
        issuer: [expectedIssuer, 'https://canvas.instructure.com', 'http://localhost:8080']
      });

      const clientId = process.env.CANVAS_CLIENT_ID || process.env.LTI_CLIENT_ID;
      
      // Delegar la validación e intentos de autorreparación al nuevo módulo
      LtiOidcRecoveryManager.validateAndRecoverAudience(decoded, clientId);
      if (this.allowedDeploymentIds.length > 0) {
        const deploymentId = decoded['https://purl.imsglobal.org/spec/lti/claim/deployment_id'];
        if (!this.allowedDeploymentIds.includes(deploymentId)) {
          throw new AppError(`deployment_id '${deploymentId}' no permitido`, 403);
        }
      }

      // LTI 1.3 / OIDC: validar azp (authorized party) contra el client_id.
      // Si el token fue emitido para otra aplicación, se rechaza (confusión de token).
      if (decoded.azp !== undefined && !LtiOidcRecoveryManager.isValidCanvasId(decoded.azp, clientId)) {
        throw new AppError(`azp '${decoded.azp}' no coincide con el client_id autorizado`, 403);
      }

      return decoded;
    } catch (error) {
      LtiOidcRecoveryManager.traceError(error, { jwksUri: this.jwksUri });
      throw new AppError('Token LTI 1.3 inválido o expirado', 401);
    }
  }
}

// Singleton compartido: evita instanciar el cliente JWKS más de una vez
// (cada instancia abre un cliente jwks-rsa y emite un log de init duplicado).
let _sharedInstance = null;
export function getLTITokenService() {
  if (!_sharedInstance) {
    _sharedInstance = new LTITokenService();
  }
  return _sharedInstance;
}
