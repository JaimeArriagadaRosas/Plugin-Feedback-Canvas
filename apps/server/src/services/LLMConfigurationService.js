import db from '../data/db.js';

export default class LLMConfigurationService {
  /**
   * Gets global AI configuration
   */
  async getConfig() {
    const query = 'SELECT * FROM Configuracion_IA LIMIT 1';
    const result = await db.query(query);
    if (result.rows.length === 0) {
      // Return default if it does not exist
      return {
        modelo_preferido: 'gemini-1.5-flash',
        prompt_base: 'You are a feedback assistant for students. Analyze the grade {{calificacion}} and the trajectory {{trayectoria}}. Generate detailed feedback.'
      };
    }
    return result.rows[0];
  }

  /**
   * Updates global AI configuration
   */
  async updateConfig(modelo_preferido, prompt_base) {
    // Check if it already exists
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
   * Builds final prompt replacing variables with context
   */
  async buildPrompt(contextData) {
    const config = await this.getConfig();
    let finalPrompt = config.prompt_base;

    // Simulated variables replacement (RF04 and RF34)
    const variables = {
      '{{curso_nombre}}': contextData.curso_nombre || 'Unknown Course',
      '{{estudiante_nombre}}': contextData.estudiante_nombre || 'Student',
      '{{calificacion}}': contextData.calificacion || 'Ungraded',
      '{{trayectoria}}': contextData.trayectoria || 'Normal',
      '{{rubrica_nombre}}': contextData.rubrica_nombre || 'N/A',
      '{{texto_plantilla}}': contextData.texto_plantilla || ''
    };

    for (const [key, value] of Object.entries(variables)) {
      // eslint-disable-next-line security/detect-non-literal-regexp
      finalPrompt = finalPrompt.replace(new RegExp(key, 'g'), value);
    }

    return {
      model: config.modelo_preferido,
      prompt: finalPrompt
    };
  }
}
