import db from './db.js';

/**
 * Repositorio de Plantillas (PostgreSQL)
 */
export default class TemplateRepository {
  async getById(id) {
    const res = await db.query('SELECT * FROM Plantilla_Feedback WHERE id = $1', [id]);
    return res.rows[0];
  }

  async listByProfesor(profesorId) {
    const res = await db.query(
      'SELECT id, nombre, contenido, profesor_id FROM Plantilla_Feedback WHERE (profesor_id = $1 OR profesor_id IS NULL) AND deleted_at IS NULL ORDER BY nombre ASC',
      [profesorId]
    );
    return res.rows;
  }

  async save(templateData, profesorId) {
    const { nombre, contenido } = templateData;
    const res = await db.query(
      'INSERT INTO Plantilla_Feedback (nombre, contenido, profesor_id) VALUES ($1, $2, $3) RETURNING *',
      [nombre, contenido, profesorId]
    );
    return res.rows[0];
  }

  async update(id, templateData, profesorId) {
    const { nombre, contenido } = templateData;
    const res = await db.query(
      'UPDATE Plantilla_Feedback SET nombre = $1, contenido = $2, actualizado_en = CURRENT_TIMESTAMP WHERE id = $3 AND profesor_id = $4 RETURNING *',
      [nombre, contenido, id, profesorId]
    );
    return res.rows[0];
  }

  async delete(id, profesorId) {
    // Soft Delete: Marcar como eliminado en lugar de borrar para no romper historial
    await db.query('UPDATE Plantilla_Feedback SET deleted_at = NOW() WHERE id = $1 AND profesor_id = $2', [id, profesorId]);
    return true;
  }

  async cloneDefaultTemplates(profesorId) {
    await db.query(
      `INSERT INTO Plantilla_Feedback (nombre, contenido, profesor_id)
       SELECT nombre, contenido, $1 FROM Plantilla_Feedback WHERE profesor_id IS NULL AND deleted_at IS NULL`,
      [profesorId]
    );
  }

  async hasSeededTemplates(profesorId) {
    const res = await db.query('SELECT has_seeded_templates FROM Profesor_Metadata WHERE profesor_id = $1', [profesorId]);
    return res.rows.length > 0 ? res.rows[0].has_seeded_templates : false;
  }

  async markTemplatesAsSeeded(profesorId) {
    await db.query(
      `INSERT INTO Profesor_Metadata (profesor_id, has_seeded_templates) 
       VALUES ($1, true) 
       ON CONFLICT (profesor_id) 
       DO UPDATE SET has_seeded_templates = true, actualizado_en = CURRENT_TIMESTAMP`,
      [profesorId]
    );
  }
}
