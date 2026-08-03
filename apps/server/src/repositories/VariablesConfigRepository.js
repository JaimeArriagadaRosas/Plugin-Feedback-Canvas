import db from '../data/db.js';

export default class VariablesConfigRepository {
  /**
   * Obtiene la configuración de variables para un curso.
   * @param {number|string} courseId El ID del curso
   * @returns {Promise<Object|null>} El JSON de configuración o null si no existe
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
   * Guarda o actualiza la configuración de variables para un curso.
   * @param {number|string} courseId El ID del curso
   * @param {Object} variablesJson El objeto de variables validado
   * @returns {Promise<Object>} El JSON guardado
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
