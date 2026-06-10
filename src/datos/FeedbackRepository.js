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
      INSERT INTO Historial_Feedback_Generado
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
      'SELECT * FROM Historial_Feedback_Generado WHERE estudiante_id = $1 AND curso_id = $2 ORDER BY fecha_generacion DESC',
      [studentId, courseId]
    );
    return res.rows;
  }

  async getStats() {
    const res = await db.query(
      'SELECT COUNT(*) as total, estado FROM Historial_Feedback_Generado GROUP BY estado'
    );
    return res.rows;
  }

  async listAll() {
    const res = await db.query(
      'SELECT * FROM Historial_Feedback_Generado ORDER BY fecha_generacion DESC'
    );
    return res.rows;
  }

  async updateStatusAndContent(id, estado, contenido) {
    const res = await db.query(
      `UPDATE Historial_Feedback_Generado 
       SET estado = $1, contenido_generado = COALESCE($2, contenido_generado) 
       WHERE id = $3 
       RETURNING *`,
      [estado, contenido, id]
    );
    return res.rows[0];
  }

  async updateProfesorRating(id, rating) {
    const res = await db.query(
      `UPDATE Historial_Feedback_Generado SET calificacion_profesor = $1 WHERE id = $2 RETURNING *`,
      [rating, id]
    );
    return res.rows[0];
  }

  async updateEstudianteRating(id, rating) {
    const res = await db.query(
      `UPDATE Historial_Feedback_Generado SET calificacion_estudiante = $1 WHERE id = $2 RETURNING *`,
      [rating, id]
    );
    return res.rows[0];
  }

  async saveNotification(estudianteId, feedbackId, mensaje, metodo = 'email') {
    const res = await db.query(
      `INSERT INTO Notificaciones_Feedback (estudiante_id, feedback_id, mensaje, metodo) VALUES ($1, $2, $3, $4) RETURNING *`,
      [estudianteId, feedbackId, mensaje, metodo]
    );
    return res.rows[0];
  }
}
