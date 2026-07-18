import { isLocalModeAllowed } from '../envGuard.js';
import { extractDevRole } from '../ltiCookie.js';
import { verifyDevToken } from '../crypto.js';
import { toRoleURN } from '../../utils/roles.js';
import logger from '../../utils/logger.js';

export class LocalIdentityProvider {
  name = 'local';

  authenticate(req) {
    if (!isLocalModeAllowed()) return null;

    const ltiTokenCookie = req.cookies?.['lti-token'] || req.cookies?.['lti_token'];
    const devTokenCookie = req.cookies?.['dev-token'];
    const devRole = extractDevRole(req);

    // SEC: el dev-token debe estar firmado con el secreto estable del servidor.
    // Antes solo se comprobaba el prefijo "dev-token:", permitiendo falsificar
    // cookies dev-token:admin:1 (escalada de rol local). Ahora se valida la firma.
    const hasSignedDevToken = (ltiTokenCookie && ltiTokenCookie.startsWith('dev-token') && verifyDevToken(ltiTokenCookie))
      || (devTokenCookie && devTokenCookie.startsWith('dev-token') && verifyDevToken(devTokenCookie));
    const hasLegacyDevToken = devTokenCookie === 'true';
    const hasDevRole = !!devRole;

    if (!hasSignedDevToken && !hasLegacyDevToken && !hasDevRole) return null;

    if ((ltiTokenCookie?.startsWith('dev-token') || devTokenCookie?.startsWith('dev-token')) && !hasSignedDevToken) {
      logger.warn('[LOCAL-AUTH] dev-token con firma inválida rechazado', { ip: req.ip });
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
    const studentIndex = studentMatch ? parseInt(studentMatch[1], 10) : null;

    const ltiRoles = [toRoleURN(baseRole)];
    const courseId = process.env.CANVAS_COURSE_ID || process.env.VITE_CANVAS_COURSE_ID || '1';

    let userId;
    if (ltiTokenCookie && ltiTokenCookie.startsWith('dev-token:') && ltiTokenCookie.split(':').length > 2) {
      userId = decodeURIComponent(ltiTokenCookie.split(':').slice(2).join(':'));
    } else {
      userId = studentMatch
        ? `local-user-student-${studentMatch[1]}`
        : `local-user-${baseRole}`;
    }

    return {
      user: userId,
      role: ltiRoles,
      courseId,
      studentId: studentIndex,
      isLocalSession: true,
      localRole: baseRole,
      source: 'dev-token'
    };
  }
}
