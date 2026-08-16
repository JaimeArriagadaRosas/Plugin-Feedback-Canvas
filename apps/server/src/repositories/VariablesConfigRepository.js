import db from '../data/db.js';

export default class VariablesConfigRepository {
  /**
   * Retrieves variable configuration for a course.
   * @param {number|string} courseId The course ID
   * @returns {Promise<Object|null>} The config JSON or null if it does not exist
   */
  async getByCourseId(courseId) {
    const query = 'SELECT config_json FROM Configuracion_Curso_Tarea WHERE contexto_tipo = $1 AND contexto_id = $2';
    const result = await db.query(query, ['curso', String(courseId)]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0].config_json;
  }

  /**
   * Saves or updates variable configuration for a course.
   * @param {number|string} courseId The course ID
   * @param {Object} variablesJson The validated variables object
   * @returns {Promise<Object>} The saved JSON
   */
  async saveForCourse(courseId, variablesJson) {
    const query = `
      INSERT INTO Configuracion_Curso_Tarea (contexto_tipo, contexto_id, config_json)
      VALUES ($1, $2, $3)
      ON CONFLICT (contexto_tipo, contexto_id)
      DO UPDATE SET
        config_json = EXCLUDED.config_json,
        actualizado_en = CURRENT_TIMESTAMP
      RETURNING config_json
    `;
    const result = await db.query(query, ['curso', String(courseId), JSON.stringify(variablesJson)]);
    return result.rows[0].config_json;
  }
}
