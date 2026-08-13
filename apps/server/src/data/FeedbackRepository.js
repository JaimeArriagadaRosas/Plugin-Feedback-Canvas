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
      nombreCurso, nombreTarea, nombreEstudiante,
      contenidoGenerado, promptUsado,
      notaCanvas, notaChile, aprobado
    } = feedbackData;

    const safeNotaCanvas = notaCanvas != null && !isNaN(Number(notaCanvas)) ? Math.round(Number(notaCanvas)) : null;

    const query = `
      INSERT INTO Historial_Feedback_Generado
        (estudiante_id, profesor_id, curso_id, tarea_id, plantilla_id, 
         nombre_curso, nombre_tarea, nombre_estudiante,
         contenido_generado, prompt_usado, nota_canvas, nota_chile, aprobado)
      SELECT $1::VARCHAR, $2::TEXT, $3::VARCHAR, $4::VARCHAR, $5::BIGINT, 
             $6::VARCHAR, $7::VARCHAR, $8::VARCHAR,
             $9::TEXT, $10::TEXT, $11::INTEGER, $12::NUMERIC, $13::BOOLEAN
      WHERE NOT EXISTS (
        SELECT 1 FROM Historial_Feedback_Generado 
        WHERE estudiante_id = $1 AND curso_id = $3 AND tarea_id = $4 
          AND (estado = 'PENDIENTE' OR estado = 'EDITADO' OR estado IS NULL)
      )
      RETURNING *
    `;
    const res = await db.query(query, [
      estudianteId, profesorId, cursoId, tareaId, plantillaId,
      nombreCurso || null, nombreTarea || null, nombreEstudiante || null,
      contenidoGenerado, promptUsado,
      safeNotaCanvas,
      notaChile ?? null,
      aprobado ?? null
    ]);
    
    if (res.rows.length === 0) {
      const existing = await this.findByStudent(estudianteId, cursoId);
      const pending = existing.find(fb => fb.tarea_id == tareaId && (fb.estado === 'PENDIENTE' || fb.estado === 'EDITADO' || !fb.estado));
      return pending;
    }
    
    return res.rows[0];
  }

  async updateGeneratedFeedback(id, feedbackData) {
    const {
      contenidoGenerado, promptUsado, notaCanvas, notaChile, aprobado
    } = feedbackData;

    const safeNotaCanvas = notaCanvas != null && !isNaN(Number(notaCanvas)) ? Math.round(Number(notaCanvas)) : null;

    const query = `
      UPDATE Historial_Feedback_Generado
      SET contenido_generado = $1, 
          prompt_usado = $2, 
          nota_canvas = $3, 
          nota_chile = $4, 
          aprobado = $5,
          fecha_generacion = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `;
    const res = await db.query(query, [
      contenidoGenerado, promptUsado, safeNotaCanvas, notaChile ?? null, aprobado ?? null, id
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

  async updateStatusAndContent(id, estado, contenido, notaCanvas = undefined) {
    const params = [estado, contenido, id];
    let query = `UPDATE Historial_Feedback_Generado 
                 SET estado = $1, contenido_generado = COALESCE($2, contenido_generado)`;
    
    if (notaCanvas !== undefined && notaCanvas !== null) {
      params.push(notaCanvas);
      query += `, nota_canvas = $${params.length}`;
    }
    
    query += ` WHERE id = $3 RETURNING *`;
    
    const res = await db.query(query, params);
    return res.rows[0];
  }

  async claimForApproval(id, contenido) {
    const res = await db.query(
      `UPDATE Historial_Feedback_Generado
       SET estado = 'APROBADO', contenido_generado = COALESCE($1, contenido_generado)
       WHERE id = $2
         AND estado IN ('PENDIENTE', 'EDITADO', 'RECHAZADO')
       RETURNING *`,
      [contenido, id]
    );
    return res.rows[0] || null;
  }

  async updateProfesorRating(id, rating) {
    const res = await db.query(
      `UPDATE Historial_Feedback_Generado SET calificacion_profesor = $1 WHERE id = $2 RETURNING *`,
      [rating, id]
    );
    return res.rows[0];
  }

  async updateEstudianteRating(id, rating, esUtil) {
    const pgRating = rating === 0 ? null : rating;
    const pgEsUtil = esUtil === undefined ? null : esUtil;

    let res = await db.query(
      `UPDATE Historial_Feedback_Generado 
       SET calificacion_estudiante = COALESCE($1, calificacion_estudiante), 
           es_util = COALESCE($2, es_util),
           actualizado_en = NOW()
       WHERE id = $3 
       RETURNING *`,
      [pgRating, pgEsUtil, id]
    );
    
    if (res.rows.length === 0) {
      res = await db.query('SELECT * FROM Historial_Feedback_Generado WHERE id = $1', [id]);
    }
    return res.rows[0];
  }

  async updatePrivateNote(id, notaPrivada) {
    const res = await db.query(
      `UPDATE Historial_Feedback_Generado SET nota_privada = $1 WHERE id = $2 RETURNING *`,
      [notaPrivada, id]
    );
    return res.rows[0];
  }

  async saveNotification(estudianteId, feedbackId, mensaje, metodo) {
    const res = await db.query(
      `INSERT INTO Notificaciones_Feedback (estudiante_id, feedback_id, mensaje, metodo) VALUES ($1, $2, $3, $4) RETURNING *`,
      [estudianteId, feedbackId, mensaje, metodo]
    );
    return res.rows[0];
  }
}
