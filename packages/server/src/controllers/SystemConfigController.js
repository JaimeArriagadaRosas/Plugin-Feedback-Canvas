import db from '../data/db.js';
import { classifyRoles, resolveViewRole } from '../utils/roles.js';
import { nowIso } from '../utils/datetime.js';
import logger from '../utils/logger.js';
import { isProduction, isHttpsEnabled } from '../security/envGuard.js';
import { verifyDevToken, signDevRole } from '../security/crypto.js';

const LOCAL_ROLES_PERMITIDOS = ['admin', 'teacher', 'student'];
const LOCAL_ROLE_PATTERN = /^student-\d+$/;

function isPermittedLocalRole(role) {
  if (!role) return false;
  if (LOCAL_ROLES_PERMITIDOS.includes(role)) return true;
  return LOCAL_ROLE_PATTERN.test(role);
}

export default class SystemConfigController {
  getStartupMode(req, res) {
    res.json({
      mode: process.env.STARTUP_MODE || '3',
      useLocalData: process.env.USE_LOCAL_DATA === 'true' || process.env.VITE_USE_LOCAL_DATA === 'true',
      localRole: null,
      initializing: global.isCanvasInitializing === true,
      dbMode: db.isLocalMode() ? 'local' : 'postgresql',
      serverTime: nowIso()
    });
  }

  setLocalRole(req, res) {
    if (isProduction()) {
      return res.status(403).json({ exito: false, error: { mensaje: 'Modo local no disponible en producción.' } });
    }

    const { role } = req.body;
    if (!role || !isPermittedLocalRole(role)) {
      return res.status(400).json({ exito: false, error: { mensaje: `Rol no válido: ${role}` } });
    }

    if (role === 'admin') {
      const ltiTokenCookie = req.cookies?.['lti-token'] || req.cookies?.['lti_token'];
      const devTokenCookie = req.cookies?.['dev-token'];
      const signed = [ltiTokenCookie, devTokenCookie]
        .filter(Boolean)
        .some(t => t.startsWith('dev-token') && verifyDevToken(t));
      if (!signed) {
        return res.status(403).json({
          exito: false,
          error: { mensaje: 'Rol admin en modo local requiere un dev-token firmado.' }
        });
      }
    }

    const secureCookies = isHttpsEnabled();
    res.cookie('dev-token', 'true', { path: '/', httpOnly: true, secure: secureCookies, sameSite: 'Lax' });
    const signedRole = signDevRole(role);
    res.cookie('dev-role', signedRole, { path: '/', httpOnly: false, secure: secureCookies, sameSite: 'Lax' });
    logger.info('Sesion local configurada mediante API', { role, ip: req.ip });
    res.json({ exito: true, role, mensaje: `Sesion local establecida como ${role}` });
  }

  clearLocalRole(req, res) {
    res.clearCookie('dev-token');
    res.clearCookie('dev-role');
    res.clearCookie('lti_token');
    logger.info('[Auth] CERRANDO SESION (Logout) / Sesion local limpiada', { ip: req.ip });
    res.json({ exito: true, mensaje: 'Sesion local eliminada' });
  }

  getMe(req, res) {
    if (req.ltiContext) {
      let userRoles = req.ltiContext.role || [];
      if (!Array.isArray(userRoles)) userRoles = [userRoles];

      const role = resolveViewRole({
        isLocalSession: req.ltiContext.isLocalSession,
        localRole: req.ltiContext.localRole,
        roles: userRoles,
        entry: req.ltiContext.entry,
        courseId: req.ltiContext.courseId
      });

      if (req.ltiContext.isLocalSession) {
        logger.info(`[Auth] INICIO DE SESION EXITOSO -> Rol resuelto: ${role} (Modo Local / Mock UI)`, {
          user: req.ltiContext.user
        });
      } else {
        logger.info(`[Auth] INICIO DE SESION EXITOSO -> Rol resuelto: ${role} (Autenticado via Canvas LMS JWT)`, {
          user: req.ltiContext.user,
          roles_claims: userRoles,
          entry: req.ltiContext.entry ?? null
        });
      }

      return res.json({
        exito: true,
        user: req.ltiContext.user,
        role,
        roles: userRoles,
        courseId: req.ltiContext.courseId,
        studentId: req.ltiContext.studentId ?? null,
        isLocalSession: req.ltiContext.isLocalSession ?? false,
        source: req.ltiContext.source ?? null
      });
    }

    logger.warn('/api/config/me llamado sin ltiContext válido');
    res.status(401).json({
      exito: false,
      error: {
        mensaje: 'Sin sesion activa. Inicie el plugin desde Canvas LMS o configure el modo local.',
        codigo: 401
      }
    });
  }
}
