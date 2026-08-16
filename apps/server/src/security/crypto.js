import crypto from 'node:crypto';

let _devTokenSecret = null;

function getDevTokenSecret() {
  if (!_devTokenSecret) {
    _devTokenSecret = process.env.DEV_TOKEN_SECRET;
    if (!_devTokenSecret) {
      throw new Error('[SECURITY] DEV_TOKEN_SECRET not configured. Define this environment variable to enable local authentication.');
    }
  }
  return _devTokenSecret;
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
  const hmac = crypto.createHmac('sha256', getDevTokenSecret());
  hmac.update(payload);
  return `${payload}.${hmac.digest('hex')}`;
}

export function verifyDevToken(token) {
  if (typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const hmac = crypto.createHmac('sha256', getDevTokenSecret());
  hmac.update(parts[0]);
  const expected = Buffer.from(hmac.digest('hex'));
  const actual = Buffer.from(parts[1]);
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

export function signDevRole(role) {
  const hmac = crypto.createHmac('sha256', getDevTokenSecret());
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
  const hmac = crypto.createHmac('sha256', getDevTokenSecret());
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

export function signOAuthState(payload) {
  const secret = process.env.ENCRYPTION_KEY || process.env.DEV_TOKEN_SECRET;
  if (!secret) {
    throw new Error('[SECURITY] ENCRYPTION_KEY or DEV_TOKEN_SECRET is required to sign OAuth states. Operation rejected (fail-closed).');
  }
  const hmac = crypto.createHmac('sha256', secret);
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64');
  hmac.update(payloadB64);
  return `${payloadB64}.${hmac.digest('hex')}`;
}

export function verifyOAuthState(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const secret = process.env.ENCRYPTION_KEY || process.env.DEV_TOKEN_SECRET;
  if (!secret) return null;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(parts[0]);
  const expected = Buffer.from(hmac.digest('hex'));
  const actual = Buffer.from(parts[1]);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
  try {
    return JSON.parse(Buffer.from(parts[0], 'base64').toString('utf8'));
  } catch {
    return null;
  }
}
