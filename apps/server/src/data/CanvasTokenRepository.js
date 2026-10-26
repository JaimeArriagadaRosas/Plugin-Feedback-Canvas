import db from './db.js';
import EncryptionService from '../services/infrastructure/EncryptionService.js';
import logger from '../utils/logger.js';

export default class CanvasTokenRepository {
  constructor() { this.unreadableRefreshTokens = new Set(); }
  async getToken(canvasSub) {

    const res = await db.query(
      'SELECT access_token, refresh_token, expires_at FROM canvas_user_tokens WHERE canvas_sub = $1',
      [canvasSub]
    );

    if (res.rowCount === 0) return null;

    const row = res.rows[0];
    const accessToken = EncryptionService.safeDecrypt(row.access_token, `Canvas AccessToken sub ${canvasSub}`);
    const refreshToken = row.refresh_token ? EncryptionService.safeDecrypt(row.refresh_token, `Canvas RefreshToken sub ${canvasSub}`) : null;

    if (!accessToken) {
      if (process.env.STARTUP_MODE === '3') {
        // In local environment we force deletion of damaged token to clear session
        await this.deleteToken(canvasSub);
      }
      return null;
    }

    return {
      accessToken,
      refreshToken,
      expiresAt: row.expires_at
    };
  }

  async saveToken(canvasSub, accessToken, refreshToken, expiresAt) {

    const encAccess = EncryptionService.encrypt(accessToken);
    const encRefresh = refreshToken ? EncryptionService.encrypt(refreshToken) : null;

    this.unreadableRefreshTokens.delete(canvasSub);
    await db.query(
      `INSERT INTO canvas_user_tokens (canvas_sub, access_token, refresh_token, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (canvas_sub) 
       DO UPDATE SET 
         access_token = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token,
         expires_at = EXCLUDED.expires_at,
         actualizado_en = NOW()`,
      [canvasSub, encAccess, encRefresh, expiresAt]
    );
  }

  async getExpiringTokens(thresholdDate) {
    const res = await db.query(
      'SELECT canvas_sub, refresh_token, expires_at FROM canvas_user_tokens WHERE expires_at IS NOT NULL AND expires_at <= $1',
      [thresholdDate]
    );

    return res.rows.map(row => {
      const refreshToken = row.refresh_token ? EncryptionService.safeDecrypt(row.refresh_token, `Canvas RefreshToken sub ${row.canvas_sub} (Rotation)`, true) : null;
      if (row.refresh_token && !refreshToken && !this.unreadableRefreshTokens.has(row.canvas_sub)) {
        this.unreadableRefreshTokens.add(row.canvas_sub);
        logger.warn('[AUTH] Stored Canvas refresh token is unreadable for ' + row.canvas_sub + '; OAuth reauthorization is required.');
      }
      if (refreshToken) this.unreadableRefreshTokens.delete(row.canvas_sub);
      return {
        canvas_sub: row.canvas_sub,
        refresh_token: refreshToken,
        expires_at: row.expires_at
      };
    }).filter(row => row.refresh_token !== null);
  }

  async deleteToken(canvasSub) {
    this.unreadableRefreshTokens.delete(canvasSub);
    await db.query('DELETE FROM canvas_user_tokens WHERE canvas_sub = $1', [canvasSub]);
  }
}
