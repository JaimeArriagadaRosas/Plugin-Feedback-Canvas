import db from './db.js';
import EncryptionService from '../services/infrastructure/EncryptionService.js';
import fs from 'node:fs';
import path from 'node:path';

export default class CanvasTokenRepository {
  async getToken(canvasSub) {
    // En modo 3 (Docker Local), el orquestador provee un token auto-sanado.
    // Según el diseño de bootstrap, debemos confiar en este token global.
    if (process.env.STARTUP_MODE === '3') {
      let freshToken = process.env.CANVAS_ACCESS_TOKEN;
      try {
        const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf8');
        const match = envContent.match(/^CANVAS_ACCESS_TOKEN=(.+)$/m);
        if (match) freshToken = match[1].trim();
      } catch (e) { /* ignore */ }

      if (freshToken) {
        return {
          accessToken: freshToken,
          refreshToken: null,
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365) // Válido por 1 año simulado
        };
      }
    }

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
    if (process.env.STARTUP_MODE === '3') return;

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

  async deleteToken(canvasSub) {
    if (process.env.STARTUP_MODE === '3') {
      try {
        const envPath = path.resolve(process.cwd(), '.env');
        let envContent = fs.readFileSync(envPath, 'utf8');
        envContent = envContent.replace(/^CANVAS_ACCESS_TOKEN=.*$/m, 'CANVAS_ACCESS_TOKEN=');
        fs.writeFileSync(envPath, envContent, 'utf8');
      } catch (e) { /* ignore */ }
      return;
    }
    await db.query('DELETE FROM canvas_user_tokens WHERE canvas_sub = $1', [canvasSub]);
  }
}
