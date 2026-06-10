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

  async saveConfigAsignacion(courseId, assignmentId, data, profesorId) {
    // Upsert logic for configuracion_asignacion
    const res = await db.query(
      `INSERT INTO configuracion_asignacion 
       (canvas_course_id, canvas_assignment_id, feedback_activo, plantilla_id, profesor_id, fecha_modificacion)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (canvas_course_id, canvas_assignment_id)
       DO UPDATE SET 
         feedback_activo = COALESCE($3, configuracion_asignacion.feedback_activo),
         plantilla_id = COALESCE($4, configuracion_asignacion.plantilla_id),
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

  async saveConfigIA(modelo, temperatura, longitudMaxima, endpointApi, userId) {
    const res = await db.query(
      `INSERT INTO configuracion_ia (modelo_activo, temperatura, longitud_maxima, endpoint_api, token_api, actualizado_por, actualizado_en)
       VALUES ($1, $2, $3, $4, 'use-tokens-ia-table', $5, CURRENT_TIMESTAMP)
       RETURNING *`,
      [modelo, temperatura, longitudMaxima, endpointApi, userId || 1]
    );
    return res.rows[0];
  }
}
