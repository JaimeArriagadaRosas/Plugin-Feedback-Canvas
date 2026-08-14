import { resolveViewRole } from '../utils/roles.js';
import { nowIso } from '../utils/datetime.js';
import logger from '../utils/logger.js';
import { isProduction, isHttpsEnabled } from '../security/envGuard.js';
import { verifyDevToken, signDevRole, signDevToken } from '../security/crypto.js';

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
      dbMode: 'postgresql',
      serverTime: nowIso()
    });
  }

  setLocalRole(req, res) {
    if (isProduction()) {
      return res.status(403).json({ exito: false, error: { mensaje: 'Local mode not available in production.' } });
    }

    const { role } = req.body;
    if (!role || !isPermittedLocalRole(role)) {
      return res.status(400).json({ exito: false, error: { mensaje: `Invalid role: ${role}` } });
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
          error: { mensaje: 'Admin role in local mode requires a signed dev-token.' }
        });
      }
    }

    const secureCookies = isHttpsEnabled();
    const signedToken = signDevToken(`dev-token:${role}:local`);
    res.cookie('dev-token', signedToken, { path: '/', httpOnly: true, secure: secureCookies, sameSite: 'Lax' });
    const signedRole = signDevRole(role);
    res.cookie('dev-role', signedRole, { path: '/', httpOnly: true, secure: secureCookies, sameSite: 'Lax' });
    logger.info('Local session configured via API', { role, ip: req.ip });
    res.json({ exito: true, role, mensaje: `Local session established as ${role}` });
  }

  clearLocalRole(req, res) {
    res.clearCookie('dev-token');
    res.clearCookie('dev-role');
    res.clearCookie('lti_token');
    logger.info('[Auth] CLOSING SESSION (Logout) / Local session cleared', { ip: req.ip });
    res.json({ exito: true, mensaje: 'Local session deleted' });
  }

  async getMe(req, res) {
    const identity = req.appIdentity;
    if (identity) {
      const role = resolveViewRole({
        isLocalSession: identity.isLocalSession,
        localRole: identity.entry,
        roles: identity.roles,
        entry: identity.entry,
        courseId: identity.courseId
      });

      if (identity.isLocalSession) {
        logger.info(`[AUTH] Active session (Local Mode) | User: ${identity.canonicalUserId?.substring(0,8)}... | Role: ${role}`);
      } else {
        const sourceStr = identity.source === 'session-token' ? 'Session Token' : 'LTI Recuperada';
        logger.info(`[AUTH] Active session (${sourceStr}) | User: ${identity.canonicalUserId?.substring(0,8)}... | Role: ${role}`);
      }

      // Get permissions manager injected in app
      const permissionsManager = req.app.get('permissionsManager');
      let permissions = {};
      if (permissionsManager) {
        const matrix = await permissionsManager.getPermissionsMatrix();
        const roleData = matrix.find(r => r.rol === role);
        if (roleData && roleData.permisos) {
          permissions = roleData.permisos;
        }
      }

      // Get AI manager to verify availability (RF64)
      const iaConfigManager = req.app.get('iaConfigManager');
      let isAiServiceAvailable = false;
      if (iaConfigManager) {
        try {
          const aiConfig = await iaConfigManager.getGlobalActiveConfig();
          if (aiConfig && aiConfig.service) {
            isAiServiceAvailable = true;
          }
        } catch (e) {
          isAiServiceAvailable = false;
        }
      }

      return res.json({
        exito: true,
        user: identity.ltiUserId, // Keep LTI UUID as primary identifier for frontend (legacy)
        userName: identity.name || identity.ltiUserId,
        role,
        roles: identity.roles,
        permissions, // NEW: Permissions are sent to frontend
        courseId: identity.canonicalCourseId || identity.courseId,
        courseName: identity.courseName,
        studentId: identity.canonicalUserId || identity.numericUserId || null, // Numeric ID for specific queries
        isLocalSession: identity.isLocalSession ?? false,
        source: identity.source ?? null,
        canonicalUserId: identity.canonicalUserId,
        isAiServiceAvailable
      });
    }

    logger.warn('/api/config/me called without valid ltiContext');
    res.status(401).json({
      exito: false,
      error: {
        mensaje: 'No active session. Start the plugin from Canvas LMS or configure local mode.',
        codigo: 401
      }
    });
  }
}
