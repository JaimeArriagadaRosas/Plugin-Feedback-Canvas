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
      logger.debug(`[AUTHZ] Autorizado como teacher (Instructor/TA/Designer/Admin)`);
    }
    // entry=teacher es solo un hint del lanzamiento; NO otorga acceso por sí solo
    // (evita escalada). Se exige clasificación real de instructor.
    if (requiredRoles.includes('teacher') && isExplicitTeacherEntry && !authorized) {
      logger.warn(`[AUTHZ] entry=teacher sin clasificación de instructor; denegado`);
    }
    if (requiredRoles.includes('admin')   && classification.isAccountAdmin) {
      authorized = true;
      logger.debug(`[AUTHZ] Autorizado como admin (AccountAdmin)`);
    }
    if (requiredRoles.includes('student') && classification.isLearner) {
      authorized = true;
      logger.debug(`[AUTHZ] Autorizado como student (Learner)`);
    }

    if (classification.isLearner) {
      const requestedStudentId = req.params?.studentId;
      const authenticatedStudentId = req.appIdentity?.numericUserId;
      if (requestedStudentId && authenticatedStudentId !== undefined && authenticatedStudentId !== null) {
        const reqId = Number(requestedStudentId);
        const authId = Number(authenticatedStudentId);
        if (reqId !== authId) {
          return next(new AppError('Acceso denegado: Solo puedes acceder a tu propio feedback.', 403));
        }
      }
    }

    logger.debug(`[AUTHZ] Rol efectivo: ${effective} | Requerido: [${requiredRoles.join(',')}] | Autorizado: ${authorized}`);

    if (!authorized) {
      return next(new AppError(`Acceso denegado: Se requiere rol [${requiredRoles.join(' o ')}], pero el usuario tiene rol '${effective}'.`, 403));
    }
    next();
  };
};
