import db from '../data/db.js';

export default class LLMConfigurationService {
  /**
   * Obtiene la configuración global de IA
   */
  async getConfig() {
    const query = 'SELECT * FROM Configuracion_IA LIMIT 1';
    const result = await db.query(query);
    if (result.rows.length === 0) {
      // Retornar por defecto si no existe
      return {
        modelo_preferido: 'gemini-1.5-flash',
        prompt_base: 'Eres un asistente de feedback para estudiantes. Analiza la calificación {{calificacion}} y la trayectoria {{trayectoria}}. Genera feedback detallado.'
      };
    }
    return result.rows[0];
  }

  /**
   * Actualiza la configuración global de IA
   */
  async updateConfig(modelo_preferido, prompt_base) {
    // Verificamos si ya existe
    const current = await db.query('SELECT id FROM Configuracion_IA LIMIT 1');
    
    if (current.rows.length === 0) {
      const query = `
        INSERT INTO Configuracion_IA (modelo_preferido, prompt_base) 
        VALUES ($1, $2) RETURNING *
      `;
      const result = await db.query(query, [modelo_preferido, prompt_base]);
      return result.rows[0];
    } else {
      const query = `
        UPDATE Configuracion_IA 
        SET modelo_preferido = $1, prompt_base = $2, actualizado_en = CURRENT_TIMESTAMP 
        WHERE id = $3 RETURNING *
      `;
      const result = await db.query(query, [modelo_preferido, prompt_base, current.rows[0].id]);
      return result.rows[0];
    }
  }

  /**
   * Construye el prompt final reemplazando las variables con el contexto
   */
  async buildPrompt(contextData) {
    const config = await this.getConfig();
    let finalPrompt = config.prompt_base;

    // Reemplazo de variables simuladas (RF04 y RF34)
    const variables = {
      '{{curso_nombre}}': contextData.curso_nombre || 'Curso Desconocido',
      '{{estudiante_nombre}}': contextData.estudiante_nombre || 'Estudiante',
      '{{calificacion}}': contextData.calificacion || 'Sin calificar',
      '{{trayectoria}}': contextData.trayectoria || 'Normal',
      '{{rubrica_nombre}}': contextData.rubrica_nombre || 'N/A',
      '{{texto_plantilla}}': contextData.texto_plantilla || ''
    };

    for (const [key, value] of Object.entries(variables)) {
      finalPrompt = finalPrompt.replace(new RegExp(key, 'g'), value);
    }

    return {
      model: config.modelo_preferido,
      prompt: finalPrompt
    };
  }
}
