/**
 * LocalTokenStore.js
 *
 * Lightweight token persistence adapter for the local environment.
 * Replaces the direct dependency on CanvasTokenRepository (apps/server)
 * that violated the installer→server boundary.
 *
 * In the context of local setup, tokens are saved in plain text
 * in PostgreSQL. AES-256-GCM encryption is the server's responsibility
 * at runtime, not the installer's during initial configuration.
 *
 * If the server needs encrypted tokens, it will encrypt them on the first
 * authenticated access using EncryptionService.
 */

import pg from 'pg';
import { createDatabaseConfig } from '@plugin-feedback/plugin-database';

const { Pool } = pg;

export class LocalTokenStore {
  constructor() {
    this._pool = null;
  }

  _getPool() {
    if (!this._pool) {
      this._pool = new Pool(createDatabaseConfig());
    }
    return this._pool;
  }

  /**
   * Saves a Canvas token in the canvas_user_tokens table.
   * Inserts or updates based on canvas_sub (UPSERT).
   *
   * @param {string} canvasSub - User's LTI identifier
   * @param {string} accessToken - Access token (plain text in local setup)
   * @param {string|null} refreshToken - Refresh token (optional)
   * @param {Date} expiresAt - Expiration date
   */
  async saveToken(canvasSub, accessToken, refreshToken, expiresAt) {
    const pool = this._getPool();
    await pool.query(
      `INSERT INTO canvas_user_tokens (canvas_sub, access_token, refresh_token, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (canvas_sub)
       DO UPDATE SET
         access_token = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token,
         expires_at = EXCLUDED.expires_at,
         actualizado_en = NOW()`,
      [canvasSub, accessToken, refreshToken, expiresAt]
    );
  }

  async close() {
    if (this._pool) {
      await this._pool.end();
      this._pool = null;
    }
  }
}
