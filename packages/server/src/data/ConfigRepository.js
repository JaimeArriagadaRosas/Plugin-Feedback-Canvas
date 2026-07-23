import db from './db.js';

/**
 * Repositorio de Configuraciones (PostgreSQL)
 */
export default class ConfigRepository {
  async getConfigAsignacion(courseId, assignmentId) {
    const res = await db.query(
      `SELECT * FROM configuracion_asignacion 
       WHERE canvas_course_id = $1 AND canvas_assignment_id = $2`,
      [String(courseId), String(assignmentId)]
    );
    if (res.rows.length === 0) return null;
    
    const config = res.rows[0];
    
    const varRes = await db.query(
      `SELECT * FROM variables_asignacion WHERE configuracion_id = $1`,
      [config.id_configuracion]
    );
    
    return { ...config, variables: varRes.rows };
  }

  async getConfigsByCourse(courseId) {
    const res = await db.query(
      `SELECT * FROM configuracion_asignacion WHERE canvas_course_id = $1`,
      [String(courseId)]
    );
    return res.rows;
  }

  async saveConfigAsignacion(courseId, assignmentId, data, profesorId) {
    // Upsert logic for configuracion_asignacion
    const res = await db.query(
      `INSERT INTO configuracion_asignacion 
       (canvas_course_id, canvas_assignment_id, feedback_activo, plantilla_id, profesor_id, fecha_modificacion)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (canvas_course_id, canvas_assignment_id)
       DO UPDATE SET 
         feedback_activo = EXCLUDED.feedback_activo,
         plantilla_id = EXCLUDED.plantilla_id,
         profesor_id = EXCLUDED.profesor_id,
         fecha_modificacion = CURRENT_TIMESTAMP
       RETURNING *`,
      [String(courseId), String(assignmentId), data.feedback_activo, data.plantilla_id, profesorId]
    );
    return res.rows[0];
  }

  async saveVariablesAsignacion(configuracionId, variables) {
    // Replace old variables
    await db.query(`DELETE FROM variables_asignacion WHERE configuracion_id = $1`, [configuracionId]);
    
    if (variables && variables.length > 0) {
      for (const v of variables) {
        await db.query(
          `INSERT INTO variables_asignacion (configuracion_id, variable_id, variable_activa, ponderacion)
           VALUES ($1, $2, $3, $4)`,
          [configuracionId, v.variable_id, v.variable_activa, v.ponderacion]
        );
      }
    }
  }

  async getConfigIA() {
    const res = await db.query('SELECT * FROM Configuracion_IA LIMIT 1');
    return res.rows[0] || null;
  }

  async saveConfigIA(modelo, temperatura, longitudMaxima, endpointApi, userId) {
    const current = await db.query('SELECT id FROM Configuracion_IA LIMIT 1');

    if (current.rows.length === 0) {
      const res = await db.query(
        `INSERT INTO Configuracion_IA (modelo_preferido, temperatura, longitud_maxima, endpoint_api, actualizado_en)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         RETURNING *`,
        [modelo, temperatura, longitudMaxima, endpointApi]
      );
      return res.rows[0];
    }

    const res = await db.query(
      `UPDATE Configuracion_IA
       SET modelo_preferido = $1, temperatura = $2, longitud_maxima = $3, endpoint_api = $4, actualizado_en = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [modelo, temperatura, longitudMaxima, endpointApi, current.rows[0].id]
    );
    return res.rows[0];
  }
}
