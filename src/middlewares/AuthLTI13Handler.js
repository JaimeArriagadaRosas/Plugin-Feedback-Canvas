import LTITokenService from '../servicios/LTITokenService.js';
import { AppError } from './ErrorHandler.js';

const ltiService = new LTITokenService();

// ─────────────────────────────────────────────────────────────────────────────
// MAPA DE ROLES LTI IMS GLOBAL (URNs estándar de LTI 1.3)
// ─────────────────────────────────────────────────────────────────────────────
const LTI_ROLE_URNS = {
  admin:   ['http://purl.imsglobal.org/vocab/lis/v2/membership#Administrator',
            'http://purl.imsglobal.org/vocab/lis/v2/institution/person#Administrator'],
  teacher: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'],
  student: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner']
};

/**
 * Resuelve una clave de rol (que puede ser 'admin', 'teacher', 'student', 'student-1', etc.)
 * y devuelve { baseRole, studentIndex, ltiRoles, userId, courseId }
 *
 * FIX CRÍTICO 5: Soporte correcto para roles student-X (student-1, student-2, ...)
 * El lookup de roles ahora extrae el baseRole antes de buscar en el mapa.
 */
function resolveLocalRole(rawRole, fallbackCourseId = '1') {
  const isStudentVariant = rawRole && rawRole.startsWith('student-');
  const baseRole = isStudentVariant ? 'student' : (rawRole || 'admin');
  const studentIndex = isStudentVariant ? parseInt(rawRole.split('-')[1], 10) : null;

  const ltiRoles = LTI_ROLE_URNS[baseRole] || LTI_ROLE_URNS.admin;
  const userId = isStudentVariant
    ? `local-user-student-${studentIndex}`
    : `local-user-${baseRole}`;

  return {
    baseRole,
    studentIndex,
    ltiRoles,
    userId,
    courseId: fallbackCourseId
  };
}

/**
 * Middleware de Autenticación LTI 1.3
 *
 * Orden de prioridad para establecer req.ltiContext:
 *   1. Token JWT real de Canvas (Authorization header o cookie lti_token) → verificación real
 *   2. Token 'dev-token' (entorno local) → resolución por variable de entorno USE_LOCAL_DATA
 *   3. Sin token + USE_LOCAL_DATA=true + LOCAL_USER_ROLE definido → acceso local directo
 *   4. Sin token + ruta pública → pasar sin contexto
 *   5. Sin token + ruta protegida → 401
 *
 * FIX CRÍTICO 4: setupLocalContext de server.js eliminado. Toda la lógica
 *   de contexto LTI está centralizada aquí. Sin duplicación.
 */
export const AuthLTI13Handler = async (req, res, next) => {
  const timestamp = new Date().toISOString();
  const reqId = Math.random().toString(36).substring(2, 8);
  const path = req.path;
  const method = req.method;

  console.log(`[LTI-AUTH] [${reqId}] ${timestamp} → ${method} ${path}`);

  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : req.cookies?.lti_token || null;

    const useLocalData = process.env.USE_LOCAL_DATA === 'true' ||
                         process.env.VITE_USE_LOCAL_DATA === 'true';
    const localUserRole = process.env.LOCAL_USER_ROLE ||
                          'admin';

    console.log(`[LTI-AUTH] [${reqId}] Token: ${token ? (token === 'dev-token' ? '"dev-token" (local)' : `JWT (${token.length} chars)`) : 'ninguno'} | Modo local: ${useLocalData} | Rol local: ${localUserRole}`);

    // ── CASO 1: Token de desarrollo local ('dev-token') ─────────────────────
    if (token === 'dev-token') {
      if (!useLocalData) {
        console.warn(`[LTI-AUTH] [${reqId}] dev-token recibido pero USE_LOCAL_DATA no está habilitado. Rechazando.`);
        throw new AppError('Token de desarrollo no válido en este modo. Active el modo local.', 401);
      }

      const resolved = resolveLocalRole(localUserRole, process.env.VITE_CANVAS_COURSE_ID || '1');
      req.ltiContext = {
        user: resolved.userId,
        role: resolved.ltiRoles,
        courseId: resolved.courseId,
        studentId: resolved.studentIndex,
        isLocalSession: true,
        localRole: resolved.baseRole
      };

      console.log(`[LTI-AUTH] [${reqId}] ✅ Sesión local establecida | Usuario: ${resolved.userId} | Rol: ${resolved.baseRole} | StudentId: ${resolved.studentIndex ?? 'N/A'}`);
      return next();
    }

    // ── CASO 2: Sin token + modo local activo + rol configurado ─────────────
    if (!token && useLocalData && localUserRole) {
      const resolved = resolveLocalRole(localUserRole, process.env.VITE_CANVAS_COURSE_ID || '1');
      req.ltiContext = {
        user: resolved.userId,
        role: resolved.ltiRoles,
        courseId: resolved.courseId,
        studentId: resolved.studentIndex,
        isLocalSession: true,
        localRole: resolved.baseRole
      };

      console.log(`[LTI-AUTH] [${reqId}] ✅ Sesión local implícita (sin token) | Usuario: ${resolved.userId} | Rol: ${resolved.baseRole}`);
      return next();
    }

    // ── CASO 3: Rutas públicas sin token ────────────────────────────────────
    if (!token) {
      const publicPaths = ['/lti/login', '/lti/callback', '/lti/jwks', '/health', '/config/startup-mode', '/config/set-local-role', '/config/clear-local-role', '/config/me'];
      const isPublic = publicPaths.some(pub => path === pub || path.startsWith(pub));
      if (isPublic) {
        console.log(`[LTI-AUTH] [${reqId}] Ruta pública, sin requerir token: ${path}`);
        return next();
      }

      console.error(`[LTI-AUTH] [${reqId}] ❌ BLOQUEADO: Sin token y ruta protegida: ${path}`);
      console.error(`[LTI-AUTH] [${reqId}] CAUSA PROBABLE: El plugin no fue iniciado desde Canvas LMS, o el token LTI expiró.`);
      throw new AppError('No autorizado: Token LTI 1.3 ausente. Inicie el plugin desde Canvas LMS.', 401);
    }

    // ── CASO 4: Token JWT real de Canvas — Verificación completa ─────────────
    console.log(`[LTI-AUTH] [${reqId}] Verificando token JWT real con Canvas JWKS...`);
    let decoded;
    try {
      decoded = await ltiService.verifyToken(token);
    } catch (verifyError) {
      console.error(`[LTI-AUTH] [${reqId}] ❌ Token inválido o corrupto: ${verifyError.message}`);
      throw new AppError(`Validación LTI 1.3 fallida: ${verifyError.message}`, 401);
    }

    const ltiRoles = decoded['https://purl.imsglobal.org/spec/lti/claim/roles'] || [];
    req.ltiContext = {
      user: decoded.sub,
      role: ltiRoles,
      courseId: decoded['https://purl.imsglobal.org/spec/lti/claim/context']?.id,
      deploymentId: decoded['https://purl.imsglobal.org/spec/lti/claim/deployment_id'],
      isLocalSession: false
    };

    console.log(`[LTI-AUTH] [${reqId}] ✅ Token JWT Canvas verificado | Sub: ${decoded.sub} | Roles: ${ltiRoles.join(', ')}`);
    next();

  } catch (error) {
    console.error(`[LTI-AUTH] [${reqId}] Error en handler:`, error.message);
    next(error);
  }
};

/**
 * Middleware de Autorización por Roles
 * Verifica que el usuario tenga al menos uno de los roles requeridos.
 */
export const authorizeRole = (requiredRoles) => {
  return (req, res, next) => {
    let userRoles = req.ltiContext?.role || [];
    if (!Array.isArray(userRoles)) userRoles = [userRoles];

    const isTeacher  = userRoles.some(r => r.includes('Instructor'));
    const isAdmin    = userRoles.some(r => r.includes('Admin'));
    const isStudent  = userRoles.some(r => r.includes('Learner'));

    let authorized = false;
    if (requiredRoles.includes('teacher') && (isTeacher || isAdmin)) authorized = true;
    if (requiredRoles.includes('admin')   && isAdmin)                 authorized = true;
    if (requiredRoles.includes('student') && isStudent)               authorized = true;

    const resolvedRole = isAdmin ? 'admin' : isTeacher ? 'teacher' : isStudent ? 'student' : 'unknown';
    console.log(`[AUTHZ] Rol resuelto: ${resolvedRole} | Requerido: [${requiredRoles.join(',')}] | Autorizado: ${authorized}`);

    if (!authorized) {
      return next(new AppError(`Acceso denegado: Se requiere rol [${requiredRoles.join(' o ')}], pero el usuario tiene rol '${resolvedRole}'.`, 403));
    }
    next();
  };
};
