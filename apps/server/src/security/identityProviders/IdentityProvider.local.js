import { isLocalModeAllowed } from '../envGuard.js';
import { extractDevRole } from '../ltiCookie.local.js';
import { verifyDevToken } from '../crypto.js';
import { toRoleURN } from '../../utils/roles.js';
import logger from '../../utils/logger.js';

export class IdentityProviderLocal {
  name = 'local';

  authenticate(req) {
    if (!isLocalModeAllowed() && process.env.ENABLE_TEST_AUTH_BYPASS !== 'true') return null;

    const ltiTokenCookie = req.cookies?.['lti-token'] || req.cookies?.['lti_token'];
    const devTokenCookie = req.cookies?.['dev-token'];
    const devRole = extractDevRole(req);

    // SEC: el dev-token debe estar firmado con el secreto estable del servidor.
    // Antes solo se comprobaba el prefijo "dev-token:", permitiendo falsificar
    // cookies dev-token:admin:1 (escalada de rol local). Ahora se valida la firma.
    const hasSignedDevToken = (ltiTokenCookie && ltiTokenCookie.startsWith('dev-token') && verifyDevToken(ltiTokenCookie))
      || (devTokenCookie && devTokenCookie.startsWith('dev-token') && verifyDevToken(devTokenCookie));
    const hasDevRole = !!devRole;

    if (!hasSignedDevToken && !hasDevRole) return null;

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
    // NOTA DE SEGURIDAD: el dev-token es `dev-token:<rol>:<id>.<hmac>`. Nunca se
    // usa el payload crudo como userId porque filtraría la firma HMAC a los logs
    // (ej. "local-user-teacher.<hash>"). Se deriva un userId estable a partir
    // del rol y, si existe, del id numérico (parte 2, sin la firma).
    const tokenParts = (ltiTokenCookie && ltiTokenCookie.startsWith('dev-token:') && ltiTokenCookie.includes('.'))
      ? ltiTokenCookie.split('.')[0].split(':')
      : [];
    const tokenUserId = tokenParts.length > 2 ? tokenParts[2] : null;

    if (tokenUserId) {
      // Derivamos un pseudo UUID constante basado en el ID numérico
      const paddedId = String(tokenUserId).padStart(12, '0');
      userId = baseRole === 'student'
        ? `00000000-0000-0000-0000-${paddedId}`
        : `00000000-0000-0000-0001-${paddedId}`;
    } else {
      // Fallback estático
      userId = baseRole === 'student'
        ? (studentMatch ? `00000000-0000-0000-0000-${String(studentMatch[1]).padStart(12, '0')}` : '00000000-0000-0000-0000-000000000002')
        : '00000000-0000-0000-0001-000000000003';
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
