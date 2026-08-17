import { AppError } from '../utils/errors.js';
import { classifyRoles, resolveEffectiveRole } from '../utils/roles.js';
import logger from '../utils/logger.js';

export const authorizeRole = (requiredRoles) => {
  return (req, res, next) => {
    const userRoles = req.appIdentity?.roles || [];
    const classification = classifyRoles(userRoles);
    const effective = resolveEffectiveRole(classification);

    let authorized = false;
    const isExplicitTeacherEntry = req.appIdentity?.entry === 'teacher';

    if (requiredRoles.includes('teacher') && (classification.isInstructor || classification.isTA || classification.isDesigner || classification.isAccountAdmin)) {
      authorized = true;
      logger.debug('[AUTHZ] Authorized as teacher (Instructor/TA/Designer/Admin)');
    }
    // entry=teacher is only a hint from the launch; DO NOT grant access on its own
    // (prevents escalation). Real instructor classification is required.
    if (requiredRoles.includes('teacher') && isExplicitTeacherEntry && !authorized) {
      logger.warn('[AUTHZ] entry=teacher without instructor classification; denied');
    }
    if (requiredRoles.includes('admin')   && classification.isAccountAdmin) {
      authorized = true;
      logger.debug('[AUTHZ] Authorized as admin (AccountAdmin)');
    }
    if (requiredRoles.includes('student') && classification.isLearner) {
      authorized = true;
      logger.debug('[AUTHZ] Authorized as student (Learner)');
    }

    if (classification.isLearner) {
      const requestedStudentId = req.params?.studentId;
      const authenticatedStudentId = req.appIdentity?.numericUserId;
      if (requestedStudentId && authenticatedStudentId !== undefined && authenticatedStudentId !== null) {
        const reqId = Number(requestedStudentId);
        const authId = Number(authenticatedStudentId);
        if (reqId !== authId) {
          return next(new AppError('Access denied: You can only access your own feedback.', 403));
        }
      }
    }

    logger.debug(`[AUTHZ] Effective role: ${effective} | Required: [${requiredRoles.join(',')}] | Authorized: ${authorized}`);

    if (!authorized) {
      return next(new AppError(`Access denied: Required role [${requiredRoles.join(',')}], but user has role '${effective}'.`, 403));
    }
    next();
  };
};
