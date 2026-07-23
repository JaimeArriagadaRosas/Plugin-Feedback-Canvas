import jwt from 'jsonwebtoken';
import { getRolesFromClaims, getEntryFromClaims } from '../../utils/roles.js';
import logger from '../../utils/logger.js';
import { keyManagerService } from '../auth/KeyManagerService.js';

const SESSION_TOKEN_EXPIRY_MS = parseInt(process.env.SESSION_TOKEN_EXPIRY_MS || '28800000', 10);

export function getSessionPublicKeyPem() {
  const { publicKeyPem } = keyManagerService.ensureKeys();
  return publicKeyPem;
}

export function signSessionToken(claims) {
  const { privateKeyPem } = keyManagerService.ensureKeys();
  const payload = {
    sub: claims.sub,
    iss: 'plugin-session',
    aud: 'plugin',
    azp: claims.azp,
    'https://purl.imsglobal.org/spec/lti/claim/deployment_id': claims.deploymentId,
    'https://purl.imsglobal.org/spec/lti/claim/context': claims.context,
    'https://purl.imsglobal.org/spec/lti/claim/lis': claims.lis,
    'https://purl.imsglobal.org/spec/lti/claim/roles': claims.roles,
    'https://purl.imsglobal.org/spec/lti/claim/custom': { unida_entry: claims.entry },
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + Math.floor(SESSION_TOKEN_EXPIRY_MS / 1000),
  };
  return jwt.sign(payload, privateKeyPem, { algorithm: 'RS256' });
}

export function verifySessionToken(token) {
  const { publicKeyPem } = keyManagerService.ensureKeys();
  const decoded = jwt.verify(token, publicKeyPem, { algorithms: ['RS256'] });
  if (decoded.iss !== 'plugin-session') {
    throw new Error('Issuer inválido para session_token');
  }
  if (decoded.aud !== 'plugin') {
    throw new Error('Audience inválida para session_token');
  }
  return decoded;
}
