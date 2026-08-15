import logger from '../../utils/logger.js';

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
    logger.info('[JOBS] Starting proactive token rotation job.');
    // Ejecutar inicialmente con un ligero retraso (5s) para no ensuciar los logs de "Arranque completado"
    setTimeout(() => {
      this.run().catch(e => logger.error(`[JOBS] Initial error: ${e.message}`));
    }, 5000);
    
    // Configurar intervalo
    this.timer = setInterval(() => {
      this.run().catch(e => logger.error(`[JOBS] Execution error: ${e.message}`));
    }, this.intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('[JOBS] Job stopped.');
    }
  }

  async run() {
    logger.debug('[JOBS] Scanning expiring tokens...');
    try {
      // 15 minutos de margen
      const upcomingExpiryThreshold = new Date(Date.now() + 15 * 60 * 1000);
      
      const expiringTokens = await this.tokenRepo.getExpiringTokens(upcomingExpiryThreshold);
      
      if (!expiringTokens || expiringTokens.length === 0) {
        return; // Nada que refrescar
      }

      logger.info(`\n[JOBS] Found ${expiringTokens.length} expiring tokens. Refreshing...`);

      for (const tokenData of expiringTokens) {
        if (!tokenData.refresh_token) {
          logger.debug(`[JOBS] Skipping token for ${tokenData.canvas_sub} (no refresh_token).`);
          continue;
        }

        try {
          await this.tokenManager.refreshToken(tokenData.canvas_sub, tokenData.refresh_token);
        } catch (err) {
          logger.warn(`[JOBS] Could not proactively rotate token for ${tokenData.canvas_sub}: ${err.message}`);
        }
      }
    } catch (e) {
      logger.error(`[JOBS] Critical error scanning/rotating tokens: ${e.message}`);
    }
  }
}
