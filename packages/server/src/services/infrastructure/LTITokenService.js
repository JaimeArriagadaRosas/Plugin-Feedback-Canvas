import jwt from 'jsonwebtoken';
import { AppError } from '../../utils/errors.js';
import logger from '../../utils/logger.js';
import LtiOidcRecoveryManager from '../../middlewares/LtiOidcRecoveryManager.js';
import { getJwksClient } from '../auth/CanvasJwksClient.js';

export default class LTITokenService {
  constructor() {
    this.jwksClient = getJwksClient();
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

  async verifyToken(token) {
    try {
      const decodedHeader = jwt.decode(token, { complete: true })?.header;
      if (!decodedHeader) throw new AppError('Token mal formado', 401);

      const publicKey = await this.jwksClient.getPublicKey(decodedHeader);
      logger.info(`[LTI-TOKEN] Token validado con éxito vía JWKS (Canvas) | kid: ${decodedHeader.kid?.substring(0,10)}...`);
      
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
