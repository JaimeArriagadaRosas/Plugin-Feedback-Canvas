import db from './db.js';

/**
 * Repositorio de Configuraciones (PostgreSQL)
 */
export default class ConfigRepository {
  async getByContext(type, id) {
    const res = await db.query(
      'SELECT config_json FROM configuraciones WHERE contexto_tipo = $1 AND contexto_id = $2',
      [type, id]
    );
    return res.rows[0]?.config_json || null;
  }

  async saveOrUpdate(type, id, configJson) {
    const res = await db.query(
      `INSERT INTO configuraciones (contexto_tipo, contexto_id, config_json)
       VALUES ($1, $2, $3)
       ON CONFLICT (contexto_tipo, contexto_id)
       DO UPDATE SET config_json = $3, actualizado_en = CURRENT_TIMESTAMP
       RETURNING *`,
      [type, id, configJson]
    );
    return res.rows[0];
  }
}
