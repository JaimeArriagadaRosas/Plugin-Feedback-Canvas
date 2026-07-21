import jwt from 'jsonwebtoken';
import { generateKeyPairSync } from 'node:crypto';
import { getRolesFromClaims, getEntryFromClaims } from '../../utils/roles.js';
import logger from '../../utils/logger.js';

const SESSION_TOKEN_EXPIRY_MS = parseInt(process.env.SESSION_TOKEN_EXPIRY_MS || '28800000', 10);

let _privateKeyPem = null;
let _publicKeyPem = null;

function ensureKeys() {
  if (!_privateKeyPem) {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicExponent: 0x10001,
    });
    _privateKeyPem = privateKey.export({ format: 'pem', type: 'pkcs1' });
    _publicKeyPem = publicKey.export({ format: 'pem', type: 'spki' });
    logger.info('[SESSION-TOKEN] Par de claves RSA generado para session_token');
  }
  return { privateKeyPem: _privateKeyPem, publicKeyPem: _publicKeyPem };
}

export function getSessionPublicKeyPem() {
  ensureKeys();
  return _publicKeyPem;
}

export function signSessionToken(claims) {
  const { privateKeyPem } = ensureKeys();
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
  const { publicKeyPem } = ensureKeys();
  const decoded = jwt.verify(token, publicKeyPem, { algorithms: ['RS256'] });
  if (decoded.iss !== 'plugin-session') {
    throw new Error('Issuer inválido para session_token');
  }
  if (decoded.aud !== 'plugin') {
    throw new Error('Audience inválida para session_token');
  }
  return decoded;
}
