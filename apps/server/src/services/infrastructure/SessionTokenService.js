import jwt from 'jsonwebtoken';
import { } from '../../utils/roles.js';
import { keyManagerService } from '../auth/KeyManagerService.js';

const SESSION_TOKEN_EXPIRY_MS = parseInt(process.env.SESSION_TOKEN_EXPIRY_MS || '28800000', 10);

export function getSessionPublicKeyPem() {
  const { publicKeyPem } = keyManagerService.ensureKeys();
  return publicKeyPem;
}

import db from '../../data/db.js';

export async function signSessionToken(claims) {
  const { privateKeyPem } = keyManagerService.ensureKeys();
  const expTimestamp = Math.floor(Date.now() / 1000) + Math.floor(SESSION_TOKEN_EXPIRY_MS / 1000);
  const payload = {
    sub: claims.sub,
    name: claims.name,
    iss: 'plugin-session',
    aud: 'plugin',
    azp: claims.azp,
    'https://purl.imsglobal.org/spec/lti/claim/deployment_id': claims.deploymentId,
    'https://purl.imsglobal.org/spec/lti/claim/context': claims.context,
    'https://purl.imsglobal.org/spec/lti/claim/lis': claims.lis,
    'https://purl.imsglobal.org/spec/lti/claim/roles': claims.roles,
    'https://purl.imsglobal.org/spec/lti/claim/custom': { 
      unida_entry: claims.entry,
      canvas_user_id: claims.studentId,
      canvas_course_id: claims.numericCourseId
    },
    iat: Math.floor(Date.now() / 1000),
    exp: expTimestamp,
  };
  const token = jwt.sign(payload, privateKeyPem, { algorithm: 'RS256' });
  const sessionId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
  
  // Guardar en BD para cumplir persistencia
  await db.query(
    'INSERT INTO plugin_sessions (session_id, user_id, jwt_token, expires_at) VALUES ($1, $2, $3, to_timestamp($4)) ON CONFLICT DO NOTHING',
    [sessionId, claims.sub, token, expTimestamp]
  );
  
  return token;
}

export async function verifySessionToken(token) {
  const { publicKeyPem } = keyManagerService.ensureKeys();
  const decoded = jwt.verify(token, publicKeyPem, { algorithms: ['RS256'] });
  if (decoded.iss !== 'plugin-session') {
    throw new Error('Issuer inválido para session_token');
  }
  if (decoded.aud !== 'plugin') {
    throw new Error('Audience inválida para session_token');
  }

  // Verificar si existe en BD y no ha expirado
  const res = await db.query('SELECT session_id FROM plugin_sessions WHERE jwt_token = $1 AND expires_at > NOW()', [token]);
  if (res.rowCount === 0) {
    throw new Error('Sesión expirada o no encontrada en BD (Persistencia requerida)');
  }

  return decoded;
}
