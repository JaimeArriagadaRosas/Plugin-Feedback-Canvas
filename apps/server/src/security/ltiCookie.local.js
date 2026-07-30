import { isLocalModeAllowed } from './envGuard.js';
import { verifyDevToken, extractDevRoleFromSigned } from './crypto.js';
import { DEV_ROLE_COOKIE } from './ltiCookie.js';

export function extractDevRole(req) {
  if (!isLocalModeAllowed() && process.env.ENABLE_TEST_AUTH_BYPASS !== 'true') return null;
  // eslint-disable-next-line security/detect-object-injection
  const signedCookieRole = req.cookies?.[DEV_ROLE_COOKIE] || null;
  if (signedCookieRole) {
    const role = extractDevRoleFromSigned(signedCookieRole);
    if (role) return role;
  }
  return process.env.LOCAL_USER_ROLE || null;
}

export function isDevToken(token) {
  return verifyDevToken(token);
}

export function resolveLtiUserIdentity(req, extractLtiTokenFn, explicitRole = null, explicitUserId = null) {
  const token = extractLtiTokenFn(req);

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
