import bcrypt from 'bcrypt';
import { AppError } from '../utils/errors.js';
import { isProduction } from '../security/envGuard.js';
import UsuarioRepository from '../data/UsuarioRepository.js';
import { toRoleURN } from '../utils/roles.js';
import logger from '../utils/logger.js';
import db from '../data/db.js';
import { signDevToken, signDevRole } from '../security/index.js';

const usuarioRepo = new UsuarioRepository();

export default class LocalAuthController {
  async localLogin(req, res, next) {
    try {
      if (isProduction()) {
        throw new AppError('Local login not allowed in production', 403);
      }

      const { email, password } = req.body || {};

      if (!email || !password) {
        throw new AppError('Email and password are required', 400);
      }

      const user = await usuarioRepo.findByEmail(email);
      if (!user || !user.activo) {
        throw new AppError('Invalid credentials', 401);
      }

      const passwordMatch = await bcrypt.compare(password, user.password_hash);
      if (!passwordMatch) {
        throw new AppError('Invalid credentials', 401);
      }

      const roleURN = toRoleURN(user.rol);
      const roles = [roleURN];
      const studentIndex = user.estudiante_index || null;

      const devTokenPayload = `dev-token:${user.rol}:${user.id}`;
      const devToken = signDevToken(devTokenPayload);
      const signedRole = signDevRole(user.rol);

      const isSecure = req.secure || req.get('x-forwarded-proto') === 'https';
      res.cookie('dev-token', devToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite: isSecure ? 'None' : 'Lax',
        maxAge: 8 * 60 * 60 * 1000,
      });

      res.cookie('dev-role', signedRole, {
        httpOnly: true,
        secure: isSecure,
        sameSite: isSecure ? 'None' : 'Lax',
        maxAge: 8 * 60 * 60 * 1000,
      });

      const deploymentId = process.env.LTI_DEPLOYMENT_IDS?.split(',')[0]?.trim() || 'local-deployment';
      const issuer = process.env.LTI_ISSUER || 'local-issuer';

      await db.query(
        `INSERT INTO user_lti_mappings (local_user_id, canvas_sub, canvas_uuid, deployment_id, issuer)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (local_user_id, deployment_id, issuer) DO UPDATE SET
           canvas_sub = EXCLUDED.canvas_sub,
           canvas_uuid = EXCLUDED.canvas_uuid`,
        [user.id, user.canvas_user_id, user.canvas_user_uuid, deploymentId, issuer]
      );

      logger.info('[LOCAL-AUTH] Successful login', { rol: user.rol, userId: user.canvas_user_id });

      return res.json({
        exito: true,
        devToken,
        user: {
          id: user.canvas_user_id,
          email: user.email,
          nombre: user.nombre,
          rol: user.rol,
          roles,
          studentIndex,
          isLocalSession: true,
          source: 'local-login',
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async localLogout(req, res, next) {
    try {
      if (isProduction()) {
        throw new AppError('Local logout not allowed in production', 403);
      }

      const isSecure = req.secure || req.get('x-forwarded-proto') === 'https';
      res.clearCookie('dev-token', { httpOnly: true, secure: isSecure, sameSite: isSecure ? 'None' : 'Lax' });
      res.clearCookie('dev-role', { httpOnly: false, secure: isSecure, sameSite: isSecure ? 'None' : 'Lax' });

      logger.info('[LOCAL-AUTH] ✅ LOGOUT successful: local session closed (dev-token/dev-role cookies removed)');

      return res.json({ exito: true });
    } catch (err) {
      next(err);
    }
  }

  async ltiLogout(req, res, next) {
    try {
      if (isProduction()) {
        throw new AppError('LTI logout not allowed in production', 403);
      }

      const isSecure = req.secure || req.get('x-forwarded-proto') === 'https';
      res.clearCookie('lti_token', { httpOnly: true, secure: isSecure, sameSite: isSecure ? 'None' : 'Lax' });
      res.clearCookie('session-token', { httpOnly: true, secure: isSecure, sameSite: isSecure ? 'None' : 'Lax' });

      logger.info('[LTI-AUTH] [OK] Successful LTI 1.3 LOGOUT: lti_token and session-token cookies removed');

      return res.json({ exito: true });
    } catch (err) {
      next(err);
    }
  }
}