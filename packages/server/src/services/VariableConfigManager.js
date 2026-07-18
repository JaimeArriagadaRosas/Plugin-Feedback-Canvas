import db from '../data/db.js';

export default class VariableConfigManager {
  /**
   * Obtiene las variables configuradas para un curso.
   * Si no existe configuración, devuelve la por defecto.
   */
  async getCourseVariables(courseId) {
    const query = 'SELECT config_json FROM Configuracion_Curso_Tarea WHERE contexto_tipo = $1 AND contexto_id = $2';
    const result = await db.query(query, ['curso', String(courseId)]);
    
    if (result.rows.length === 0) {
      return this.getDefaultVariables();
    }
    
    return result.rows[0].config_json;
  }

  /**
   * Actualiza las variables para un curso específico.
   */
  async saveCourseVariables(courseId, variablesObj) {
    const query = `
      INSERT INTO Configuracion_Curso_Tarea (contexto_tipo, contexto_id, config_json)
      VALUES ($1, $2, $3)
      ON CONFLICT (contexto_tipo, contexto_id)
      DO UPDATE SET
        config_json = EXCLUDED.config_json,
        actualizado_en = CURRENT_TIMESTAMP
      RETURNING config_json
    `;
    const res = await db.query(query, ['curso', String(courseId), JSON.stringify(variablesObj)]);
    return res.rows[0].config_json;
  }

  getDefaultVariables() {
    return {
      'calificacion': true,
      'trayectoria': true,
      'criterios_rubrica': false,
      'texto_plantilla': true,
      'estudiante_nombre': true
    };
  }
}
