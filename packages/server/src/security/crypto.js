import crypto from 'node:crypto';

const DEV_TOKEN_SECRET = process.env.DEV_TOKEN_SECRET;
if (!DEV_TOKEN_SECRET) {
  throw new Error('DEV_TOKEN_SECRET no configurado. Defina esta variable de entorno para habilitar autenticación local.');
}

export function secureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

export function secureState() {
  return secureToken(24);
}

export function secureNonce() {
  return secureToken(24);
}

export function secureRequestId() {
  return crypto.randomBytes(6).toString('hex');
}

export function signDevToken(payload) {
  const hmac = crypto.createHmac('sha256', DEV_TOKEN_SECRET);
  hmac.update(payload);
  return `${payload}.${hmac.digest('hex')}`;
}

export function verifyDevToken(token) {
  if (typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const hmac = crypto.createHmac('sha256', DEV_TOKEN_SECRET);
  hmac.update(parts[0]);
  const expected = Buffer.from(hmac.digest('hex'));
  const actual = Buffer.from(parts[1]);
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

export function signDevRole(role) {
  const hmac = crypto.createHmac('sha256', DEV_TOKEN_SECRET);
  hmac.update(role);
  const sig = hmac.digest('hex');
  return `${role}.${sig}`;
}

export function verifyDevRole(signedRole) {
  if (typeof signedRole !== 'string') return false;
  const parts = signedRole.split('.');
  if (parts.length !== 2) return false;
  const role = parts[0];
  const sig = parts[1];
  const hmac = crypto.createHmac('sha256', DEV_TOKEN_SECRET);
  hmac.update(role);
  const expected = Buffer.from(hmac.digest('hex'));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

export function extractDevRoleFromSigned(signedRole) {
  if (typeof signedRole !== 'string') return null;
  const parts = signedRole.split('.');
  if (parts.length !== 2) return null;
  if (!verifyDevRole(signedRole)) return null;
  return parts[0];
}

