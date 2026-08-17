import db from './db.js';

/**
 * Template Repository (PostgreSQL)
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
    // Soft Delete: Mark as deleted instead of deleting to not break history
    await db.query('UPDATE Plantilla_Feedback SET deleted_at = NOW() WHERE id = $1 AND profesor_id = $2', [id, profesorId]);
    return true;
  }

  async cloneDefaultTemplates(profesorId) {
    const res = await db.query('SELECT count(*) as count FROM Plantilla_Feedback WHERE profesor_id IS NULL AND deleted_at IS NULL');
    if (parseInt(res.rows[0].count) === 0) {
      await db.query(`
        INSERT INTO Plantilla_Feedback (nombre, contenido, profesor_id) VALUES 
        ('Standard Class', '{"alto":"Dear {{student_name}},\\n\\nYour grade is {{grade}}.\\n\\nYou have done very well, excellent work.\\n\\nBest regards,\\nTeacher","medio":"Dear {{student_name}},\\n\\nYour grade is {{grade}}.\\n\\nYou have done a somewhat adequate job, but there are aspects you can improve.\\n\\nBest regards,\\nTeacher","bajo":"Dear {{student_name}},\\n\\nYour grade is {{grade}}.\\n\\nPlease, you need to put in more effort. Consult the material to improve.\\n\\nBest regards,\\nTeacher"}', NULL),
        ('Detailed Feedback', '{"alto":"Dear {{student_name}},\\n\\nYour grade is {{grade}}. You have shown an outstanding mastery of the concepts, with a very solid foundation that shows a great level of understanding and dedication.\\n\\nKeep it up, excellent performance!\\n\\nRegards,\\nTeacher","medio":"Dear {{student_name}},\\n\\nYour grade is {{grade}}. You have a good foundation, but there are specific areas we need to reinforce to achieve full mastery of the topics covered in this assessment.\\n\\nI encourage you to review the study material.\\n\\nRegards,\\nTeacher","bajo":"Dear {{student_name}},\\n\\nYour grade is {{grade}}. It is essential that we review the content covered in class, as it is evident that key concepts are not yet consolidated.\\n\\nPlease contact me to clarify doubts or attend tutoring hours.\\n\\nRegards,\\nTeacher"}', NULL),
        ('Peer Review', '{"alto":"Hello {{student_name}},\\n\\nYour grade is {{grade}}. Your peers and I agree that your work is outstanding and adds great value to the peer review.\\n\\nCongratulations!\\n\\nRegards,\\nTeacher","medio":"Hello {{student_name}},\\n\\nYour grade is {{grade}}. According to the peer review, your performance is average, presenting an adequate job but with improvement opportunities identified by your peers.\\n\\nKeep working!\\n\\nRegards,\\nTeacher","bajo":"Hello {{student_name}},\\n\\nYour grade is {{grade}}. The peer review indicates there are significant weaknesses in your submission that must be addressed, according to the co-evaluation consensus.\\n\\nReview your peers'' comments.\\n\\nRegards,\\nTeacher"}', NULL);
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
