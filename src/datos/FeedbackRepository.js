import db from './db.js';

/**
 * Repositorio de Historial de Feedbacks (PostgreSQL)
 */
export default class FeedbackRepository {
  async save(feedbackData) {
    const { estudianteId, cursoId, tareaId, plantillaId, contenidoGenerado, promptUsado } = feedbackData;
    const res = await db.query(
      `INSERT INTO historial_feedbacks 
       (estudiante_id, curso_id, tarea_id, plantilla_id, contenido_generado, prompt_usado) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [estudianteId, cursoId, tareaId, plantillaId, contenidoGenerado, promptUsado]
    );
    return res.rows[0];
  }

  async findByStudent(studentId, courseId) {
    const res = await db.query(
      'SELECT * FROM historial_feedbacks WHERE estudiante_id = $1 AND curso_id = $2 ORDER BY fecha_generacion DESC',
      [studentId, courseId]
    );
    return res.rows;
  }

  async getStats() {
    const res = await db.query('SELECT COUNT(*) as total, estado FROM historial_feedbacks GROUP BY estado');
    return res.rows;
  }
}
