import logger from '../../utils/logger.js';
import { AppError } from '../../utils/errors.js';

export default class CanvasTokenManager {
  constructor(canvasTokenRepo, env, canvasClient) {
    this.tokenRepo = canvasTokenRepo;
    this.canvasBaseUrl = env.canvasBaseUrl;
    this.clientId = env.canvasClientId;
    this.clientSecret = process.env.CANVAS_CLIENT_SECRET || process.env.LTI_CLIENT_SECRET || '';
    this.canvasClient = canvasClient;
  }

  async getValidToken(teacherId) {
    if (!teacherId) {
      throw new Error('[CanvasTokenManager] Se requiere teacherId para autenticar la llamada a Canvas.');
    }

    const tokenData = await this.tokenRepo.getToken(teacherId);
    if (!tokenData) {
      throw new AppError(`Token OAuth no encontrado para el usuario ${teacherId}`, 401, { requireOAuth: true });
    }

    const isExpired = tokenData.expiresAt && new Date(tokenData.expiresAt).getTime() < (Date.now() + 5 * 60000);
    
    if (isExpired && tokenData.refreshToken) {
      logger.info(`[CanvasTokenManager] Token expirado para ${teacherId}, intentando refrescar...`);
      return this.refreshToken(teacherId, tokenData.refreshToken);
    } else if (isExpired) {
      throw new AppError(`Token expirado y sin refresh_token para ${teacherId}`, 401, { requireOAuth: true });
    }

    return tokenData.accessToken;
  }

  async refreshToken(teacherId, refreshToken) {
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
          throw new Error(`Error HTTP ${response.status} al refrescar token`);
        }

        const data = await response.json();
        const newExpiresAt = new Date(Date.now() + data.expires_in * 1000);
        const newRefreshToken = data.refresh_token || refreshToken;

        await this.tokenRepo.saveToken(teacherId, data.access_token, newRefreshToken, newExpiresAt);
        logger.info(`[CanvasTokenManager] Token refrescado con éxito para ${teacherId}`);
        
        return data.access_token;
      } catch (error) {
        attempt++;
        if (attempt >= maxRetries) {
          logger.error(`[CanvasTokenManager] Fallo al refrescar token para ${teacherId} tras ${maxRetries} intentos`, { error: error.message });
          throw new AppError(`Error al refrescar credenciales con Canvas: ${error.message}`, 401, { requireOAuth: true });
        }
        const jitter = Math.floor(Math.random() * 1000);
        const delay = Math.pow(2, attempt) * 1000 + jitter;
        logger.warn(`[CanvasTokenManager] Reintentando refresh para ${teacherId} en ${delay}ms (intento ${attempt}/${maxRetries})...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  async invalidateToken(teacherId) {
    logger.info(`[CanvasTokenManager] Invalidando token para ${teacherId} (Probable 401 de Canvas)`);
    try {
       await this.tokenRepo.deleteToken(teacherId);
    } catch(e) {
       logger.error(`[CanvasTokenManager] Error al invalidar token para ${teacherId}: ${e.message}`);
    }
  }
}
