import LTITokenService from '../servicios/LTITokenService.js';
import { AppError } from './ErrorHandler.js';

const ltiService = new LTITokenService();

/**
 * Middleware de autenticación LTI 1.3 Mejorado (con soporte para Mocks)
 */
export const AuthLTI13Handler = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.cookies?.lti_token;

    // Simulación de roles para desarrollo/mocks
    if (process.env.NODE_ENV === 'development') {
      const mockRole = req.headers['x-mock-role'];
      if (mockRole || token === 'dev-token') {
        const roles = {
          admin: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Administrator'],
          teacher: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'],
          student: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner']
        };
        req.ltiContext = { 
          user: 'dev-user', 
          role: roles[mockRole] || roles.teacher,
          courseId: '123'
        };
        return next();
      }
    }

    if (!token) {
      if (req.path === '/api/lti/login' || req.path === '/api/health') return next();
      throw new AppError('No autorizado: Token LTI 1.3 ausente', 401);
    }

    const decoded = await ltiService.verifyToken(token);
    
    req.ltiContext = {
      user: decoded.sub,
      role: decoded['https://purl.imsglobal.org/spec/lti/claim/roles'] || [],
      courseId: decoded['https://purl.imsglobal.org/spec/lti/claim/context']?.id,
      deploymentId: decoded['https://purl.imsglobal.org/spec/lti/claim/deployment_id']
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware de Autorización por Roles
 */
export const authorizeRole = (requiredRoles) => {
  return (req, res, next) => {
    const userRoles = req.ltiContext?.role || [];
    
    const isTeacher = userRoles.some(r => r.includes('Instructor'));
    const isAdmin = userRoles.some(r => r.includes('Administrator'));
    const isStudent = userRoles.some(r => r.includes('Learner'));

    let authorized = false;
    if (requiredRoles.includes('teacher') && (isTeacher || isAdmin)) authorized = true;
    if (requiredRoles.includes('admin') && isAdmin) authorized = true;
    if (requiredRoles.includes('student') && isStudent) authorized = true;

    if (!authorized) {
      return next(new AppError('Acceso denegado: No tienes los permisos necesarios', 403));
    }
    next();
  };
};
