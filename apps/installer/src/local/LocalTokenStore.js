/**
 * LocalTokenStore.js
 *
 * Adaptador ligero de persistencia de tokens para el entorno local.
 * Reemplaza la dependencia directa a CanvasTokenRepository (apps/server)
 * que violaba la frontera instalador→servidor.
 *
 * En el contexto de setup local, los tokens se guardan en texto plano
 * en PostgreSQL. El cifrado AES-256-GCM es responsabilidad del servidor
 * en runtime, no del instalador durante la configuración inicial.
 *
 * Si el servidor necesita tokens cifrados, los cifrará en el primer
 * acceso autenticado usando EncryptionService.
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
   * Guarda un token de Canvas en la tabla canvas_user_tokens.
   * Inserta o actualiza según canvas_sub (UPSERT).
   *
   * @param {string} canvasSub - Identificador LTI del usuario
   * @param {string} accessToken - Token de acceso (texto plano en setup local)
   * @param {string|null} refreshToken - Token de refresco (opcional)
   * @param {Date} expiresAt - Fecha de expiración
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
