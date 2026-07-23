import db from './db.js';

/**
 * Repositorio de Historial de Feedbacks (PostgreSQL + Local)
 */
export default class FeedbackRepository {
  async executeTransaction(callback) {
    return db.executeTransaction(callback);
  }
  async save(feedbackData) {
    const {
      estudianteId, profesorId, cursoId, tareaId, plantillaId,
      contenidoGenerado, promptUsado,
      notaCanvas, notaChile, aprobado
    } = feedbackData;

    const query = `
      INSERT INTO Historial_Feedback_Generado
        (estudiante_id, profesor_id, curso_id, tarea_id, plantilla_id, contenido_generado, prompt_usado, nota_canvas, nota_chile, aprobado)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    const res = await db.query(query, [
      estudianteId, profesorId, cursoId, tareaId, plantillaId,
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

  async getStats(courseId, assignmentId) {
    let query = 'SELECT COUNT(*) as total, estado FROM Historial_Feedback_Generado WHERE 1=1';
    const params = [];
    if (courseId) {
      params.push(courseId);
      query += ` AND curso_id = $${params.length}`;
    }
    if (assignmentId) {
      params.push(assignmentId);
      query += ` AND tarea_id = $${params.length}`;
    }
    query += ' GROUP BY estado';
    const res = await db.query(query, params);
    return res.rows;
  }

  async getGradeDistribution(courseId, assignmentId) {
    let query = 'SELECT nota_chile as grade, COUNT(*) as count FROM Historial_Feedback_Generado WHERE nota_chile IS NOT NULL';
    const params = [];
    if (courseId) {
      params.push(courseId);
      query += ` AND curso_id = $${params.length}`;
    }
    if (assignmentId) {
      params.push(assignmentId);
      query += ` AND tarea_id = $${params.length}`;
    }
    query += ' GROUP BY nota_chile ORDER BY nota_chile DESC';
    const res = await db.query(query, params);
    return res.rows;
  }

  async getStudentRatingDistribution(courseId, assignmentId) {
    let query = 'SELECT calificacion_estudiante as rating, COUNT(*) as count FROM Historial_Feedback_Generado WHERE calificacion_estudiante IS NOT NULL';
    const params = [];
    if (courseId) {
      params.push(courseId);
      query += ` AND curso_id = $${params.length}`;
    }
    if (assignmentId) {
      params.push(assignmentId);
      query += ` AND tarea_id = $${params.length}`;
    }
    query += ' GROUP BY calificacion_estudiante ORDER BY calificacion_estudiante DESC';
    const res = await db.query(query, params);
    return res.rows;
  }

  async listAll(limit = null, courseId = null) {
    let query = 'SELECT * FROM Historial_Feedback_Generado WHERE 1=1';
    const params = [];
    if (courseId) {
      params.push(courseId);
      query += ` AND curso_id = $${params.length}`;
    }
    query += ' ORDER BY fecha_generacion DESC';
    if (limit !== null && limit !== undefined) {
      params.push(limit);
      query += ` LIMIT $${params.length}`;
    }
    const res = await db.query(query, params);
    return res.rows;
  }

  async getById(id) {
    const res = await db.query(
      'SELECT * FROM Historial_Feedback_Generado WHERE id = $1',
      [id]
    );
    return res.rows[0];
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

  async updatePrivateNote(id, notaPrivada) {
    const res = await db.query(
      `UPDATE Historial_Feedback_Generado SET nota_privada = $1 WHERE id = $2 RETURNING *`,
      [notaPrivada, id]
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
