import { normalizeSeedTemplateContent } from '../services/templates/normalizeSeedTemplateContent.js';
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

  async hasLocaleTemplateRecord(profesorId) {
    const names = ['Standard Class', 'Detailed Feedback', 'Peer Review'];
    // A soft-deleted default is deliberately absent from the visible list, but counts as provisioned.
    const result = await db.query(
      'SELECT COUNT(DISTINCT nombre)::int AS count FROM Plantilla_Feedback WHERE profesor_id=$1 AND nombre=ANY($2::text[])',
      [profesorId, names]
    );
    return result.rows[0].count === names.length;
  }

  async cloneDefaultTemplates(profesorId) {
    const names = ['Standard Class', 'Detailed Feedback', 'Peer Review'];
    const connection = await db.pool.connect();
    try {
      await connection.query('BEGIN');
      await connection.query("SELECT pg_advisory_xact_lock(hashtext('feedback-english-default-templates'))");
      await connection.query(`
        WITH seed(nombre, contenido, profesor_id) AS (VALUES
('Standard Class', '{"alto":"Dear {{student_name}},\\n\\n\\n\\nYou have done very well, excellent work.\\n\\nBest regards,\\nTeacher","medio":"Dear {{student_name}},\\n\\n\\n\\nYou have done a somewhat adequate job, but there are aspects you can improve.\\n\\nBest regards,\\nTeacher","bajo":"Dear {{student_name}},\\n\\n\\n\\nPlease, you need to put in more effort. Consult the material to improve.\\n\\nBest regards,\\nTeacher"}', NULL),
        ('Detailed Feedback', '{"alto":"Dear {{student_name}},\\n\\nYou have shown an outstanding mastery of the concepts, with a very solid foundation that shows a great level of understanding and dedication.\\n\\nKeep it up, excellent performance!\\n\\nRegards,\\nTeacher","medio":"Dear {{student_name}},\\n\\nYou have a good foundation, but there are specific areas we need to reinforce to achieve full mastery of the topics covered in this assessment.\\n\\nI encourage you to review the study material.\\n\\nRegards,\\nTeacher","bajo":"Dear {{student_name}},\\n\\nIt is essential that we review the content covered in class, as it is evident that key concepts are not yet consolidated.\\n\\nPlease contact me to clarify doubts or attend tutoring hours.\\n\\nRegards,\\nTeacher"}', NULL),
        ('Peer Review', '{"alto":"Hello {{student_name}},\\n\\nYour peers and I agree that your work is outstanding and adds great value to the peer review.\\n\\nCongratulations!\\n\\nRegards,\\nTeacher","medio":"Hello {{student_name}},\\n\\nAccording to the peer review, your performance is average, presenting an adequate job but with improvement opportunities identified by your peers.\\n\\nKeep working!\\n\\nRegards,\\nTeacher","bajo":"Hello {{student_name}},\\n\\nThe peer review indicates there are significant weaknesses in your submission that must be addressed, according to the co-evaluation consensus.\\n\\nReview your peers'' comments.\\n\\nRegards,\\nTeacher"}', NULL)
        )
        INSERT INTO Plantilla_Feedback(nombre, contenido, profesor_id)
        SELECT seed.nombre, seed.contenido, NULL FROM seed
        WHERE NOT EXISTS (
          SELECT 1 FROM Plantilla_Feedback existing
          WHERE existing.nombre = seed.nombre
            AND existing.profesor_id IS NULL AND existing.deleted_at IS NULL
        );
      `);
      // Normalize only the English seeds, never unrelated global templates.
      const defaults = await connection.query(
        'SELECT id, contenido FROM Plantilla_Feedback WHERE profesor_id IS NULL AND deleted_at IS NULL AND nombre=ANY($1::text[])',
        [names]
      );
      for (const seed of defaults.rows) {
        const normalized = normalizeSeedTemplateContent(seed.contenido);
        if (normalized !== seed.contenido) {
          await connection.query(
            'UPDATE Plantilla_Feedback SET contenido=$1 WHERE id=$2 AND profesor_id IS NULL',
            [normalized, seed.id]
          );
        }
      }
      await connection.query(`
        INSERT INTO Plantilla_Feedback(nombre, contenido, profesor_id)
        SELECT original.nombre, original.contenido, $1::varchar(50)
        FROM Plantilla_Feedback original
        WHERE original.profesor_id IS NULL AND original.deleted_at IS NULL
          AND original.nombre=ANY($2::text[])
          AND NOT EXISTS (
            SELECT 1 FROM Plantilla_Feedback own
            WHERE own.profesor_id=$1::varchar(50) AND own.nombre=original.nombre
          )
        ON CONFLICT (nombre, profesor_id) DO NOTHING
      `, [profesorId, names]);
      await connection.query('COMMIT');
    } catch (error) {
      await connection.query('ROLLBACK');
      throw error;
    } finally {
      connection.release();
    }
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
