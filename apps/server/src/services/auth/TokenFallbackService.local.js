import fs from 'node:fs';
import path from 'node:path';
import logger from '../../utils/logger.js';

class TokenFallbackServiceLocal {
  constructor() {
    this.tmpPath = path.resolve(process.cwd(), 'tmp', 'canvas_local_users.json');
  }

  async getFallbackToken(canvasSub, ltiContext) {
    if (process.env.STARTUP_MODE !== '3') {
      return null;
    }

    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      if (fs.existsSync(this.tmpPath)) {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const data = JSON.parse(fs.readFileSync(this.tmpPath, 'utf8'));
        
        let user = null;
        if (ltiContext && ltiContext.localRole) {
          // Attempt to match by role since canvas_local_users.json doesn't contain UUIDs
          user = data.usuarios?.find(u => u.rol === ltiContext.localRole && u.token);
        }
        
        if (!user) {
           // Si no se encuentra un usuario explícito, fallar de manera estricta
           return null;
        }

        if (user && user.token) {
          logger.info(`[LocalTokenFallback] Modo Docker local: Token asignado (basado en rol) desde canvas_local_users.json para sub ${canvasSub} (mapeado a ${user.email}).`);
          return user.token;
        }
      }
    } catch (e) {
      logger.warn(`[LocalTokenFallback] Error leyendo canvas_local_users.json: ${e.message}`);
    }

    return null;
  }

  async autoRegisterToken(canvasSub, localToken, canvasTokenManagerOrRepo) {
    try {
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);
      if (typeof canvasTokenManagerOrRepo.tokenRepo?.saveToken === 'function') {
        await canvasTokenManagerOrRepo.tokenRepo.saveToken(canvasSub, localToken, null, expiresAt);
        logger.info(`[LocalTokenFallback] Sub LTI ${canvasSub} registrado en BD con token local.`);
      } else if (typeof canvasTokenManagerOrRepo.saveToken === 'function') {
        await canvasTokenManagerOrRepo.saveToken(canvasSub, localToken, null, expiresAt);
        logger.info(`[LocalTokenFallback] Sub LTI ${canvasSub} registrado en BD con token local.`);
      }
    } catch (dbErr) {
      logger.warn(`[LocalTokenFallback] Could not register LTI sub in DB (non-critical): ${dbErr.message}`);
    }
  }
}

export const localTokenFallbackService = new TokenFallbackServiceLocal();
