// config/ai.js - AI Engine configuration
require('dotenv').config();

module.exports = {
  // Default LLM Provider
  defaultProvider: process.env.AI_PROVIDER || 'openai',
  
  // Provider configurations
  providers: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      apiEndpoint: process.env.OPENAI_ENDPOINT || 'https://api.openai.com/v1/chat/completions',
      defaultModel: process.env.OPENAI_MODEL || 'gpt-4o',
      temperature: parseFloat(process.env.AI_TEMPERATURE) || 0.7,
      maxTokens: parseInt(process.env.AI_MAX_TOKENS) || 500,
    },
    
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      apiEndpoint: process.env.ANTHROPIC_ENDPOINT || 'https://api.anthropic.com/v1/messages',
      defaultModel: process.env.ANTHROPIC_MODEL || 'claude-3-opus-20240229',
      temperature: parseFloat(process.env.AI_TEMPERATURE) || 0.7,
      maxTokens: parseInt(process.env.AI_MAX_TOKENS) || 500,
    },
    
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || '',
      apiEndpoint: process.env.GEMINI_ENDPOINT || 'https://generativelanguage.googleapis.com/v1beta/models',
      defaultModel: process.env.GEMINI_MODEL || 'gemini-1.5-pro',
      temperature: parseFloat(process.env.AI_TEMPERATURE) || 0.7,
      maxTokens: parseInt(process.env.AI_MAX_TOKENS) || 500,
    },
    
    // Fallback mock provider for testing/offline mode
    mock: {
      enabled: true,
      delay: 500 // ms delay to simulate API call
    }
  },
  
  // Prompt templates
  prompts: {
    excellent: `Eres un docente universitario experto en retroalimentación pedagógica. 

Contexto del estudiante:
- Nombre: {{nombre_estudiante}}
- Calificación actual: {{calificacion}} (rango 6.0-7.0)
- Historial del curso: {{historial_curricular}}
- Promedio del curso: {{promedio_curso}}
- Variables adicionales: {{variables_personalizacion}}

Instrucciones:
1. Felicita al estudiante por su excelente desempeño.
2. Menciona logros específicos reflejados en la calificación.
3. Anima a mantener el esfuerzo y a compartir conocimientos con compañeros.
4. Sugiere desafíos adicionales o profundización si es apropiado.
5. Mantén un tono positivo, cálido y motivador.
6. Máximo 150 palabras.
7. En español.

Genera el feedback:`,
    
    satisfactory: `Eres un docente universitario experto en retroalimentación pedagógica.

Contexto del estudiante:
- Nombre: {{nombre_estudiante}}
- Calificación actual: {{calificacion}} (rango 4.0-5.9)
- Historial del curso: {{historial_curricular}}
- Promedio del curso: {{promedio_curso}}
- Variables adicionales: {{variables_personalizacion}}

Instrucciones:
1. Reconoce el desempeño satisfactorio.
2. Identifica 1-2 áreas específicas de mejora basadas en la calificación y trayectoria.
3. Proporciona sugerencias concretas y accionables.
4. Anima a seguir trabajando y ofrece apoyo.
5. Tono constructivo y alentador.
6. Máximo 150 palabras.
7. En español.

Genera el feedback:`,
    
    needsImprovement: `Eres un docente universitario experto en retroalimentación pedagógica.

Contexto del estudiante:
- Nombre: {{nombre_estudiante}}
- Calificación actual: {{calificacion}} (menor a 4.0)
- Historial del curso: {{historial_curricular}}
- Promedio del curso: {{promedio_curso}}
- Variables adicionales: {{variables_personalizacion}}

Instrucciones:
1. Expresa empatía y apoyo, no regaños.
2. Identifica posibles causas del bajo desempeño (basado en trayectoria).
3. Ofrece recomendaciones específicas: sesiones de tutoría, materiales a revisar.
4. Menciona que hay oportunidad de recuperación.
5. Proporciona esperanza y un camino claro a seguir.
6. Tono compasivo pero firme en la necesidad de mejora.
7. Máximo 150 palabras.
8. En español.

Genera el feedback:`
  },
  
  // Grade ranges
  gradeRanges: {
    excellent: { min: 6.0, max: 7.0, label: 'felicitacion' },
    satisfactory: { min: 4.0, max: 5.9, label: 'motivacion' },
    needsImprovement: { min: 0, max: 3.9, label: 'apoyo' }
  }
};
