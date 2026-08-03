import db from './db.js';
import EncryptionService from '../services/infrastructure/EncryptionService.js';

export default class CanvasTokenRepository {
  async getToken(canvasSub) {

    const res = await db.query(
      'SELECT access_token, refresh_token, expires_at FROM canvas_user_tokens WHERE canvas_sub = $1',
      [canvasSub]
    );

    if (res.rowCount === 0) return null;

    const row = res.rows[0];
    return {
      accessToken: EncryptionService.decrypt(row.access_token),
      refreshToken: row.refresh_token ? EncryptionService.decrypt(row.refresh_token) : null,
      expiresAt: row.expires_at
    };
  }

  async saveToken(canvasSub, accessToken, refreshToken, expiresAt) {

    const encAccess = EncryptionService.encrypt(accessToken);
    const encRefresh = refreshToken ? EncryptionService.encrypt(refreshToken) : null;

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

    return res.rows.map(row => ({
      canvas_sub: row.canvas_sub,
      refresh_token: row.refresh_token ? EncryptionService.decrypt(row.refresh_token) : null,
      expires_at: row.expires_at
    }));
  }

  async deleteToken(canvasSub) {

    await db.query('DELETE FROM canvas_user_tokens WHERE canvas_sub = $1', [canvasSub]);
  }
}
