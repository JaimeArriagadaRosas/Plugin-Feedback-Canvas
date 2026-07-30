import logger from '../../utils/logger.js';
import CanvasTokenRepository from '../../data/CanvasTokenRepository.js';
import CanvasTokenManager from './CanvasTokenManager.js';

export default class TokenRotationJob {
  constructor(canvasTokenManager, intervalMs = 5 * 60 * 1000) {
    this.tokenManager = canvasTokenManager;
    this.tokenRepo = canvasTokenManager.tokenRepo;
    this.intervalMs = intervalMs;
    this.timer = null;
  }

  start() {
    if (this.timer) {
      return;
    }
    logger.info('[JOBS] Iniciando job proactivo de rotación de tokens.');
    // Ejecutar inicialmente con un ligero retraso (5s) para no ensuciar los logs de "Arranque completado"
    setTimeout(() => {
      this.run().catch(e => logger.error(`[JOBS] Error inicial: ${e.message}`));
    }, 5000);
    
    // Configurar intervalo
    this.timer = setInterval(() => {
      this.run().catch(e => logger.error(`[JOBS] Error en ejecución: ${e.message}`));
    }, this.intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('[JOBS] Job detenido.');
    }
  }

  async run() {
    logger.debug('[JOBS] Escaneando tokens próximos a expirar...');
    try {
      // 15 minutos de margen
      const upcomingExpiryThreshold = new Date(Date.now() + 15 * 60 * 1000);
      
      const expiringTokens = await this.tokenRepo.getExpiringTokens(upcomingExpiryThreshold);
      
      if (!expiringTokens || expiringTokens.length === 0) {
        return; // Nada que refrescar
      }

      logger.info(`[JOBS] Se encontraron ${expiringTokens.length} tokens próximos a expirar. Refrescando...`);

      for (const tokenData of expiringTokens) {
        if (!tokenData.refresh_token) {
          logger.debug(`[JOBS] Saltando token de ${tokenData.canvas_sub} (no tiene refresh_token).`);
          continue;
        }

        try {
          await this.tokenManager.refreshToken(tokenData.canvas_sub, tokenData.refresh_token);
        } catch (err) {
          logger.warn(`[JOBS] No se pudo rotar el token proactivamente para ${tokenData.canvas_sub}: ${err.message}`);
        }
      }
    } catch (e) {
      logger.error(`[JOBS] Error crítico al escanear/rotar tokens: ${e.message}`);
    }
  }
}
