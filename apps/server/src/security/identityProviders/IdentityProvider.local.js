import { isLocalModeAllowed } from '../envGuard.js';
import { extractDevRole } from '../ltiCookie.local.js';
import { verifyDevToken } from '../crypto.js';
import logger from '../../utils/logger.js';
import { IdentityFactory } from '../../domain/identity/IdentityFactory.js';

export class IdentityProviderLocal {
  name = 'local';

  authenticate(req) {
    if (!isLocalModeAllowed() && process.env.ENABLE_TEST_AUTH_BYPASS !== 'true') return null;

    const ltiTokenCookie = req.cookies?.['lti-token'] || req.cookies?.['lti_token'];
    const devTokenCookie = req.cookies?.['dev-token'];
    const devRole = extractDevRole(req);

    // SEC: the dev-token must be signed with the stable server secret.
    // Previously only the "dev-token:" prefix was checked, allowing spoofing
    // of dev-token:admin:1 cookies (local role escalation). Now the signature is validated.
    const hasSignedDevToken = (ltiTokenCookie && ltiTokenCookie.startsWith('dev-token') && verifyDevToken(ltiTokenCookie))
      || (devTokenCookie && devTokenCookie.startsWith('dev-token') && verifyDevToken(devTokenCookie));
    const hasDevRole = !!devRole;

    if (!hasSignedDevToken && !hasDevRole) return null;

    if ((ltiTokenCookie?.startsWith('dev-token') || devTokenCookie?.startsWith('dev-token')) && !hasSignedDevToken) {
      logger.warn('[LOCAL-AUTH] dev-token with invalid signature rejected', { ip: req.ip });
      return null;
    }

    let resolvedRole;
    if (ltiTokenCookie && ltiTokenCookie.startsWith('dev-token:')) {
      const parts = ltiTokenCookie.split(':');
      resolvedRole = parts[1] || devRole || 'teacher';
    } else {
      resolvedRole = devRole || 'teacher';
    }

    const studentMatch = resolvedRole && resolvedRole.match(/^student-(\d+)$/);
    const baseRole = studentMatch ? 'student' : resolvedRole;
    

    
    const courseId = process.env.CANVAS_COURSE_ID || process.env.VITE_CANVAS_COURSE_ID || '1';

    let userId;
    // SECURITY NOTE: the dev-token is `dev-token:<role>:<id>.<hmac>`. The raw
    // payload is never used as userId because it would leak the HMAC signature to logs
    // (e.g. "local-user-teacher.<hash>"). A stable userId is derived from
    // the role and, if it exists, the numeric id (part 2, without the signature).
    const tokenParts = (ltiTokenCookie && ltiTokenCookie.startsWith('dev-token:') && ltiTokenCookie.includes('.'))
      ? ltiTokenCookie.split('.')[0].split(':')
      : [];
    const tokenUserId = tokenParts.length > 2 ? tokenParts[2] : null;

    if (tokenUserId) {
      // We derive a constant pseudo UUID based on the numeric ID
      const paddedId = String(tokenUserId).padStart(12, '0');
      userId = baseRole === 'student'
        ? `00000000-0000-0000-0000-${paddedId}`
        : `00000000-0000-0000-0001-${paddedId}`;
    } else {
      // Static fallback
      userId = baseRole === 'student'
        ? (studentMatch ? `00000000-0000-0000-0000-${String(studentMatch[1]).padStart(12, '0')}` : '00000000-0000-0000-0000-000000000002')
        : '00000000-0000-0000-0001-000000000003';
    }

    return IdentityFactory.fromLocalUser(userId, baseRole, courseId);
  }
}
