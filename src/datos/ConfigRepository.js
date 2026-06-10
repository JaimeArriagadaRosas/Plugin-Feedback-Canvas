import db from './db.js';

/**
 * Repositorio de Configuraciones (PostgreSQL) adaptado para Configuracion_Curso_Tarea
 */
export default class ConfigRepository {
  async getConfigAsignacion(courseId, assignmentId) {
    // Buscar configuración específica de la tarea
    const res = await db.query(
      `SELECT config_json FROM Configuracion_Curso_Tarea 
       WHERE contexto_tipo = 'tarea' AND contexto_id = $1`,
      [String(assignmentId)]
    );
    if (res.rows.length > 0) {
      return res.rows[0].config_json;
    }

    // Fallback a configuración de curso
    const courseRes = await db.query(
      `SELECT config_json FROM Configuracion_Curso_Tarea 
       WHERE contexto_tipo = 'curso' AND contexto_id = $1`,
      [String(courseId)]
    );
    if (courseRes.rows.length > 0) {
      return courseRes.rows[0].config_json;
    }

    return null;
  }

  async saveOrUpdate(contextoTipo, contextoId, configJson) {
    // Primero obtener datos existentes para fusionar si ya existe
    const existingRes = await db.query(
      `SELECT config_json FROM Configuracion_Curso_Tarea 
       WHERE contexto_tipo = $1 AND contexto_id = $2`,
      [contextoTipo, String(contextoId)]
    );

    let mergedData = configJson;
    if (existingRes.rows.length > 0) {
      const currentConfig = existingRes.rows[0].config_json;
      mergedData = { ...currentConfig, ...configJson };
    }

    const res = await db.query(
      `INSERT INTO Configuracion_Curso_Tarea (contexto_tipo, contexto_id, config_json, actualizado_en)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (contexto_tipo, contexto_id)
       DO UPDATE SET 
         config_json = $3,
         actualizado_en = CURRENT_TIMESTAMP
       RETURNING *`,
      [contextoTipo, String(contextoId), JSON.stringify(mergedData)]
    );
    return res.rows[0];
  }

  // Mantener firmas antiguas por compatibilidad si es necesario, adaptadas a la nueva estructura
  async saveConfigAsignacion(courseId, assignmentId, data, profesorId) {
    return this.saveOrUpdate('tarea', assignmentId, data);
  }

  async saveVariablesAsignacion(configuracionId, variables) {
    return { exito: true };
  }

  async saveConfigIA(modelo, temperatura, longitudMaxima, endpointApi, userId) {
    return this.saveOrUpdate('global', 'ia_config', { modelo, temperatura, longitudMaxima, endpointApi, userId });
  }
}
