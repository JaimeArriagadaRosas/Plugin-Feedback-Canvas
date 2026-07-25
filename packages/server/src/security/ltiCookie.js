import jwt from 'jsonwebtoken';
import { isLocalModeAllowed, isHttpsEnabled, isProduction } from './envGuard.js';

const LTI_TOKEN_COOKIE = 'lti-token';
const DEV_ROLE_COOKIE = 'dev-role';
const REFRESH_THRESHOLD_MS = 15 * 60 * 1000;

export function extractLtiToken(req) {
  // LTI 1.3 token strictly relies on cookies, not Bearer tokens (which are used for Sessions)
  return req.cookies?.[LTI_TOKEN_COOKIE] || null;
}

export function getLtiTokenExpiry(req) {
  const token = extractLtiToken(req);
  if (!token) return null;
  try {
    const decoded = jwt.decode(token, { complete: false });
    if (!decoded || !decoded.exp) return null;
    return decoded.exp * 1000;
  } catch {
    return null;
  }
}

export function shouldRefreshLtiCookie(req) {
  const expiry = getLtiTokenExpiry(req);
  if (!expiry) return false;
  const remaining = expiry - Date.now();
  return remaining > 0 && remaining < REFRESH_THRESHOLD_MS;
}

export function refreshLtiCookieOptions(req, res) {
  const expiry = getLtiTokenExpiry(req);
  const token = extractLtiToken(req);
  if (!token || !expiry) return null;
  const remaining = expiry - Date.now();
  const buffer = 5 * 60 * 1000;
  const maxAge = Math.max(remaining - buffer, 0);
  if (maxAge <= 0) return null;
  return {
    name: LTI_TOKEN_COOKIE,
    value: token,
    options: {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      partitioned: true,
      maxAge
    }
  };
}

export { LTI_TOKEN_COOKIE, DEV_ROLE_COOKIE, REFRESH_THRESHOLD_MS };
