import db from './db.js';

/**
 * Repositorio de Plantillas (PostgreSQL)
 */
export default class TemplateRepository {
  async getById(id) {
    const res = await db.query('SELECT * FROM plantillas WHERE id = $1', [id]);
    return res.rows[0];
  }

  async listAll() {
    const res = await db.query('SELECT id, nombre FROM plantillas ORDER BY nombre ASC');
    return res.rows;
  }

  async save(templateData) {
    const { nombre, contenido } = templateData;
    const res = await db.query(
      'INSERT INTO plantillas (nombre, contenido) VALUES ($1, $2) RETURNING *',
      [nombre, contenido]
    );
    return res.rows[0];
  }

  async update(id, templateData) {
    const { nombre, contenido } = templateData;
    const res = await db.query(
      'UPDATE plantillas SET nombre = $1, contenido = $2, actualizado_en = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [nombre, contenido, id]
    );
    return res.rows[0];
  }

  async delete(id) {
    await db.query('DELETE FROM plantillas WHERE id = $1', [id]);
    return true;
  }
}
