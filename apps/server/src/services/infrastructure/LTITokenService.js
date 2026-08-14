import jwt from 'jsonwebtoken';
import { AppError } from '../../utils/errors.js';
import logger from '../../utils/logger.js';
import LtiOidcRecoveryManager from '../../middlewares/LtiOidcRecoveryManager.js';
import { getJwksClient } from '../auth/CanvasJwksClient.js';
import configManager from '../config/ConfigManager.js';

export default class LTITokenService {
  constructor() {
    this.jwksClient = getJwksClient();
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
      if (!decodedHeader) throw new AppError('Malformed token', 401);

      const publicKey = await this.jwksClient.getPublicKey(decodedHeader);
      logger.debug(`[LTI-TOKEN] Token successfully validated via JWKS (Canvas) | kid: ${decodedHeader.kid?.substring(0,10)}...`);
      
      
      const expectedIssuer = configManager.getCanvasIssuer();

      const decoded = jwt.verify(token, publicKey, {
        algorithms: ['RS256'],
        issuer: [expectedIssuer, 'https://canvas.instructure.com', 'http://localhost:8080']
      });

      const clientId = configManager.getLtiClientId();
      
      // Delegate validation and auto-recovery attempts to the new module
      LtiOidcRecoveryManager.validateAndRecoverAudience(decoded, clientId);
      const allowedDeploymentIds = configManager.getLtiDeploymentIds();
      if (allowedDeploymentIds.length > 0) {
        const deploymentId = decoded['https://purl.imsglobal.org/spec/lti/claim/deployment_id'];
        if (!allowedDeploymentIds.includes(deploymentId)) {
          throw new AppError(`deployment_id '${deploymentId}' not allowed`, 403);
        }
      }

      // LTI 1.3 / OIDC: validate azp (authorized party) against client_id.
      // If the token was issued for another application, it is rejected (token confusion).
      if (decoded.azp !== undefined && !LtiOidcRecoveryManager.isValidCanvasId(decoded.azp, clientId)) {
        throw new AppError(`azp '${decoded.azp}' does not match the authorized client_id`, 403);
      }

      return decoded;
    } catch (error) {
      LtiOidcRecoveryManager.traceError(error, { jwksUri: this.jwksUri });
      throw new AppError('Invalid or expired LTI 1.3 token', 401);
    }
  }
}

// Shared singleton: avoids instantiating the JWKS client more than once
// (each instance opens a jwks-rsa client and emits a duplicate init log).
let _sharedInstance = null;
export function getLTITokenService() {
  if (!_sharedInstance) {
    _sharedInstance = new LTITokenService();
  }
  return _sharedInstance;
}
