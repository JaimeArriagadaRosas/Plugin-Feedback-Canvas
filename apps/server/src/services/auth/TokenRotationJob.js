import logger from '../../utils/logger.js';

export default class TokenRotationJob {
  constructor(canvasTokenManager, intervalMs = 5 * 60 * 1000) {
    this.tokenManager = canvasTokenManager;
    this.tokenRepo = canvasTokenManager.tokenRepo;
    this.intervalMs = intervalMs;
    this.timer = null;
    this.initialTimer = null;
    this.inFlight = null;
    this.running = false;
    this.wasStarted = false;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.wasStarted = true;
    logger.info('[JOBS] Starting proactive token rotation job.');
    this.initialTimer = setTimeout(() => {
      this.initialTimer = null;
      if (this.running) this.run().catch(e => logger.error('[JOBS] Initial rotation failed: ' + e.message));
    }, 5000);
    this.timer = setInterval(() => {
      if (this.running) this.run().catch(e => logger.error('[JOBS] Rotation failed: ' + e.message));
    }, this.intervalMs);
  }

  stop() {
    this.running = false;
    if (this.initialTimer) clearTimeout(this.initialTimer);
    if (this.timer) clearInterval(this.timer);
    this.initialTimer = null;
    this.timer = null;
    logger.info('[JOBS] Job stopped.');
    // Already-running OAuth requests cannot be aborted safely here; callers can
    // await this promise during shutdown before closing the PostgreSQL pool.
    return this.inFlight ?? Promise.resolve();
  }

  async run() {
    if (this.inFlight) return this.inFlight;
    const work = this._scan();
    this.inFlight = work;
    try { return await work; } finally { if (this.inFlight === work) this.inFlight = null; }
  }

  async _scan() {
    logger.debug('[JOBS] Scanning expiring tokens...');
    try {
      const threshold = new Date(Date.now() + 15 * 60 * 1000);
      const tokens = await this.tokenRepo.getExpiringTokens(threshold);
      if (!tokens?.length) return;
      logger.info('[JOBS] Found ' + tokens.length + ' expiring tokens. Refreshing...');
      for (const tokenData of tokens) {
        if (!this.running && this.timer === null && this.initialTimer === null) {
          // Direct calls to run() in diagnostics still work, while a stopped
          // live job must not initiate additional refresh requests.
          if (this.wasStarted) break;
        }
        if (!tokenData.refresh_token) continue;
        try {
          await this.tokenManager.refreshToken(tokenData.canvas_sub, tokenData.refresh_token);
        } catch (err) {
          logger.warn('[JOBS] Could not rotate token for ' + tokenData.canvas_sub + ': ' + err.message);
        }
      }
    } catch (err) {
      logger.error('[JOBS] Rotation scan failed: ' + err.message);
    }
  }
}
