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
      'SELECT id, nombre, contenido, profesor_id FROM Plantilla_Feedback WHERE profesor_id = $1 AND deleted_at IS NULL ORDER BY nombre ASC',
      [profesorId]
    );
    return res.rows;
  }

  async save(templateData, profesorId) {
    const { nombre, contenido } = templateData;
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query(
        `INSERT INTO Plantilla_Feedback (nombre, contenido, profesor_id) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (nombre, profesor_id) DO UPDATE SET contenido = EXCLUDED.contenido 
         RETURNING *`,
        [nombre, contenido, profesorId]
      );
      await client.query('COMMIT');
      return res.rows[0];
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async update(id, templateData, profesorId) {
    const { nombre, contenido } = templateData;
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query(
        'UPDATE Plantilla_Feedback SET nombre = $1, contenido = $2, actualizado_en = CURRENT_TIMESTAMP WHERE id = $3 AND profesor_id = $4 RETURNING *',
        [nombre, contenido, id, profesorId]
      );
      await client.query('COMMIT');
      return res.rows[0];
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async delete(id, profesorId) {
    // Soft Delete: Marcar como eliminado en lugar de borrar para no romper historial
    await db.query('UPDATE Plantilla_Feedback SET deleted_at = NOW() WHERE id = $1 AND profesor_id = $2', [id, profesorId]);
    return true;
  }

  async cloneDefaultTemplates(profesorId) {
    const res = await db.query('SELECT count(*) as count FROM Plantilla_Feedback WHERE profesor_id IS NULL AND deleted_at IS NULL');
    if (parseInt(res.rows[0].count) === 0) {
      await db.query(`
        INSERT INTO Plantilla_Feedback (nombre, contenido, profesor_id) VALUES 
        ('Clase Estándar', '{"alto":"Estimado/a {{nombre_estudiante}},\\n\\nTu calificación es {{calificacion}}.\\n\\nLo has hecho muy bien, excelente trabajo.\\n\\nSaludos cordiales,\\nProfesor","medio":"Estimado/a {{nombre_estudiante}},\\n\\nTu calificación es {{calificacion}}.\\n\\nHas hecho un trabajo más o menos adecuado, pero hay aspectos que puedes mejorar.\\n\\nSaludos cordiales,\\nProfesor","bajo":"Estimado/a {{nombre_estudiante}},\\n\\nTu calificación es {{calificacion}}.\\n\\nPor favor, es necesario que le pongas mayor esfuerzo. Consulta el material para mejorar.\\n\\nSaludos cordiales,\\nProfesor"}', NULL),
        ('Feedback Detallado', '{"alto":"Estimado/a {{nombre_estudiante}},\\n\\nTu calificación es {{calificacion}}. Has demostrado un dominio sobresaliente de los conceptos, con una base muy sólida que demuestra un gran nivel de comprensión y dedicación.\\n\\n¡Sigue así, excelente desempeño!\\n\\nSaludos,\\nProfesor","medio":"Estimado/a {{nombre_estudiante}},\\n\\nTu calificación es {{calificacion}}. Tienes una buena base, pero existen áreas específicas que debemos reforzar para alcanzar un dominio completo de los temas tratados en esta evaluación.\\n\\nTe animo a revisar el material de estudio.\\n\\nSaludos,\\nProfesor","bajo":"Estimado/a {{nombre_estudiante}},\\n\\nTu calificación es {{calificacion}}. Es fundamental que repasemos el contenido visto en clase, ya que se evidencian conceptos clave que aún no están afianzados.\\n\\nPor favor, contáctame para aclarar dudas o asiste a las horas de tutoría.\\n\\nSaludos,\\nProfesor"}', NULL),
        ('Evaluación Cruzada', '{"alto":"Hola {{nombre_estudiante}},\\n\\nTu calificación es {{calificacion}}. Tus compañeros y yo coincidimos en que tu trabajo es destacado y aporta gran valor a la revisión entre pares.\\n\\n¡Felicidades!\\n\\nSaludos,\\nProfesor","medio":"Hola {{nombre_estudiante}},\\n\\nTu calificación es {{calificacion}}. Según la evaluación cruzada, tu desempeño es promedio, presentando un trabajo adecuado pero con oportunidades de mejora identificadas por tus pares.\\n\\n¡Sigue trabajando!\\n\\nSaludos,\\nProfesor","bajo":"Hola {{nombre_estudiante}},\\n\\nTu calificación es {{calificacion}}. La revisión cruzada indica que hay debilidades importantes en tu entrega que deben ser atendidas, según el consenso de la coevaluación.\\n\\nRevisa los comentarios de tus compañeros.\\n\\nSaludos,\\nProfesor"}', NULL);
      `);
    }

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
