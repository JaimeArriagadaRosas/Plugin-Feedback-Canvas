import jwt from 'jsonwebtoken';
import { isLocalModeAllowed, isHttpsEnabled, isProduction } from './envGuard.js';

const LTI_TOKEN_COOKIE = 'lti-token';
const DEV_ROLE_COOKIE = 'dev-role';
const REFRESH_THRESHOLD_MS = 15 * 60 * 1000;

export function extractLtiToken(req) {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  const cookieToken = req.cookies?.[LTI_TOKEN_COOKIE] || null;

  return bearerToken || cookieToken || null;
}

export function extractDevRole(req) {
  if (!isLocalModeAllowed()) return null;
  const signedCookieRole = req.cookies?.[DEV_ROLE_COOKIE] || null;
  if (signedCookieRole) {
    // extractDevRoleFromSigned verifica la firma y devuelve el ROL (string) o
    // null. Antes se usaba verifyDevRole, que devuelve un boolean, provocando
    // que extractDevRole retornara `true` y que resolvedRole.match(...) lanzara
    // "resolvedRole.match is not a function" (500) en LocalIdentityProvider.
    const role = extractDevRoleFromSigned(signedCookieRole);
    if (role) return role;
  }
  return process.env.LOCAL_USER_ROLE || null;
}

import { verifyDevToken, verifyDevRole, extractDevRoleFromSigned } from './crypto.js';

export function isDevToken(token) {
  return verifyDevToken(token);
}

export function resolveLtiUserIdentity(req, explicitRole = null, explicitUserId = null) {
  const token = extractLtiToken(req);

  if (isDevToken(token) && isLocalModeAllowed()) {
    const role = explicitRole || extractDevRole(req) || 'teacher';
    const studentMatch = role.match(/^student-(\d+)$/);
    const baseRole = studentMatch ? 'student' : role;
    const studentIndex = studentMatch ? parseInt(studentMatch[1], 10) : null;
    const userId = explicitUserId || (studentMatch ? `local-user-student-${studentMatch[1]}` : `local-user-${baseRole}`);
    const courseId = process.env.CANVAS_COURSE_ID || process.env.VITE_CANVAS_COURSE_ID || '1';

    return {
      user: userId,
      role: baseRole,
      studentIndex,
      courseId,
      isLocalSession: true,
      source: 'dev-token'
    };
  }

  return null;
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
  const isProd = isProduction();
  const cookieSecure = isProd || isHttpsEnabled();
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
      secure: cookieSecure,
      sameSite: cookieSecure ? 'None' : 'Lax',
      maxAge
    }
  };
}

export { LTI_TOKEN_COOKIE, DEV_ROLE_COOKIE, REFRESH_THRESHOLD_MS };
