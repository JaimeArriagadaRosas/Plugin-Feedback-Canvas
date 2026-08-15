import logger from '../../utils/logger.js';
import { AppError } from '../../utils/errors.js';

export default class CanvasTokenManager {
  constructor(canvasTokenRepo, env, canvasClient) {
    this.tokenRepo = canvasTokenRepo;
    this.canvasBaseUrl = env.canvasBaseUrl;
    this.clientId = env.canvasClientId;
    this.clientSecret = process.env.CANVAS_CLIENT_SECRET || process.env.LTI_CLIENT_SECRET || '';
    this.canvasClient = canvasClient;
    this.refreshPromises = new Map();
  }

  async getValidToken(teacherId) {
    if (!teacherId) {
      throw new Error('[AUTH] teacherId is required to authenticate Canvas API calls.');
    }

    const tokenData = await this.tokenRepo.getToken(teacherId);
    if (!tokenData) {
      throw new AppError(
        `OAuth token not found for user ${teacherId}. Authorization required.`,
        401,
        { requireOAuth: true }
      );
    }

    const isExpired = tokenData.expiresAt && new Date(tokenData.expiresAt).getTime() < (Date.now() + 5 * 60000);
    
    if (isExpired && tokenData.refreshToken) {
      logger.info(`[AUTH] Token expired for ${teacherId}, attempting to refresh...`);
      return this.refreshToken(teacherId, tokenData.refreshToken);
    } else if (isExpired) {
      throw new AppError(`Token expired and no refresh_token available for ${teacherId}`, 401, { requireOAuth: true });
    }

    return tokenData.accessToken;
  }

  async forceRefresh(teacherId) {
    logger.info(`[AUTH] Forcing token refresh for ${teacherId}...`);
    const tokenData = await this.tokenRepo.getToken(teacherId);
    if (!tokenData || !tokenData.refreshToken) {
      throw new AppError(`No refresh_token available for ${teacherId}`, 401, { requireOAuth: true });
    }
    return this.refreshToken(teacherId, tokenData.refreshToken);
  }

  async refreshToken(teacherId, refreshToken) {
    if (this.refreshPromises.has(teacherId)) {
      logger.info(`[AUTH] Refresh in progress for ${teacherId}, joining existing request...`);
      return this.refreshPromises.get(teacherId);
    }

    const refreshPromise = this._executeRefreshToken(teacherId, refreshToken);
    this.refreshPromises.set(teacherId, refreshPromise);

    try {
      const result = await refreshPromise;
      return result;
    } finally {
      this.refreshPromises.delete(teacherId);
    }
  }

  async _executeRefreshToken(teacherId, refreshToken) {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const response = await this.canvasClient.oauthFetch('/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grant_type: 'refresh_token',
            client_id: this.clientId,
            client_secret: this.clientSecret,
            refresh_token: refreshToken
          }),
          returnFullResponse: true
        });

        if (!response.ok) {
          if (response.status === 400 || response.status === 401) {
            logger.warn(`\n[AUTH] Invalid or revoked token for ${teacherId} (HTTP ${response.status}). Aborting retries.`);
            await this.invalidateToken(teacherId);
            throw new AppError(`Invalid token or grant (HTTP ${response.status})`, 401, { requireOAuth: true });
          }
          throw new Error(`HTTP Error ${response.status} refreshing token`);
        }

        const data = await response.json();
        const newExpiresAt = new Date(Date.now() + data.expires_in * 1000);
        const newRefreshToken = data.refresh_token || refreshToken;

        await this.tokenRepo.saveToken(teacherId, data.access_token, newRefreshToken, newExpiresAt);
        logger.info(`[AUTH] Token successfully refreshed for ${teacherId}`);
        
        return data.access_token;
      } catch (error) {
        // No reintentar si fue un error unrecoverable de Auth (HTTP 400/401)
        if (error instanceof AppError && error.statusCode === 401) {
          throw error;
        }
        
        attempt++;
        if (attempt >= maxRetries) {
          logger.error(`[AUTH] Failed to refresh token for ${teacherId} after ${maxRetries} attempts`, { error: error.message });
          throw new AppError(`Error refreshing credentials with Canvas: ${error.message}`, 401, { requireOAuth: true });
        }
        const jitter = Math.floor(Math.random() * 1000);
        const delay = Math.pow(2, attempt) * 1000 + jitter;
        logger.warn(`[AUTH] Retrying refresh for ${teacherId} in ${delay}ms (attempt ${attempt}/${maxRetries})...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  async invalidateToken(teacherId) {
    logger.info(`[AUTH] Invalidating token for ${teacherId} (Probable 401 from Canvas)`);
    try {
       await this.tokenRepo.deleteToken(teacherId);
    } catch(e) {
       logger.error(`[AUTH] Error invalidating token for ${teacherId}: ${e.message}`);
    }
  }
}
