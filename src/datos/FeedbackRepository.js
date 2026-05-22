import db from './db.js';

/**
 * Repositorio de Historial de Feedbacks (PostgreSQL + Mock)
 */
export default class FeedbackRepository {
  async save(feedbackData) {
    const {
      estudianteId, cursoId, tareaId, plantillaId,
      contenidoGenerado, promptUsado,
      notaCanvas, notaChile, aprobado
    } = feedbackData;

    const query = `
      INSERT INTO historial_feedbacks
        (estudiante_id, curso_id, tarea_id, plantilla_id, contenido_generado, prompt_usado, nota_canvas, nota_chile, aprobado)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const res = await db.query(query, [
      estudianteId, cursoId, tareaId, plantillaId,
      contenidoGenerado, promptUsado,
      notaCanvas ?? null,
      notaChile ?? null,
      aprobado ?? null
    ]);
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
    const res = await db.query(
      'SELECT COUNT(*) as total, estado FROM historial_feedbacks GROUP BY estado'
    );
    return res.rows;
  }

  async listAll() {
    const res = await db.query(
      'SELECT * FROM historial_feedbacks ORDER BY fecha_generacion DESC'
    );
    return res.rows;
  }
}
