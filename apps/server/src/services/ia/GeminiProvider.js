import { GoogleGenerativeAI } from "@google/generative-ai";
import IAProvider from "./IAProvider.js";
import logger from '../../utils/logger.js';
import ExponentialBackoff from '../../utils/network/ExponentialBackoff.js';
import GeminiErrorHandler from './errors/GeminiErrorHandler.js';

const OUTPUT_GUARDRAILS = `
---
REGLAS DE SALIDA (OBLIGATORIAS):
1. Entrega SOLO el texto de retroalimentación. No expliques lo que harás, no describas la plantilla, no resumas las preguntas.
2. Si vas a mencionar números, usa los datos provistos arriba —no inventes calificaciones.
3. Finaliza con un saludo cordial y tu nombre como profesor.
4. La respuesta debe estar completamente en el idioma solicitado y lista para enviar al estudiante sin modificaciones.`;

export default class GeminiProvider extends IAProvider {
  constructor(apiKey, customEndpoint = null) {
    super();
    this.apiKey = apiKey;
    this.customEndpoint = customEndpoint;
  }

  async generateFeedback(prompt, config = {}) {
    logger.info('[IA] Generando feedback con Gemini (con Exponential Backoff)...');

    const apiKey = config.apiKey || this.apiKey;
    if (!apiKey) {
      logger.warn('[IA] API Key de Gemini ausente. Usando respuesta local de respaldo.');
      return this._generateLocalResponse();
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Si hubiese customEndpoint, el SDK de Google Generative AI oficial permite baseURL
    // pero no está formalmente documentado para todos los casos. Dejamos el soporte abierto:
    if (this.customEndpoint) {
      // genAI.baseURL = this.customEndpoint; // Depende de la versión del SDK
    }

    const modelName = config.model || "gemini-3.5-flash";
    const promptConGuardrails = prompt + OUTPUT_GUARDRAILS;

    return await ExponentialBackoff.execute(async () => {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: config.temperature || 0.7,
            maxOutputTokens: config.maxOutputTokens || 2048,
          }
        });

        const result = await model.generateContent(promptConGuardrails);
        const response = await result.response;
        const text = response.text().trim();

        if (!text || text.length < 20) {
          logger.warn('[IA] Respuesta vacía o muy corta. Usando fallback local.');
          return this._generateLocalResponse();
        }

        return text;
      } catch (error) {
        GeminiErrorHandler.handleError(error);
      }
    }, { maxRetries: 3, baseDelay: 1000 });
  }

  async fetchAvailableModels(apiKey) {
    // El SDK de @google/generative-ai no tiene un listModels público simple en todas sus versiones sin autenticación de Google Cloud.
    // Usaremos fetch directo a la REST API para obtener los modelos, o devolveremos los conocidos estáticos si falla.
    return await ExponentialBackoff.execute(async () => {
      try {
        const targetKey = apiKey || this.apiKey;
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${targetKey}`);
        
        if (!response.ok) {
           const errorData = await response.json().catch(() => ({}));
           const err = new Error(errorData?.error?.message || 'Error fetch models');
           err.status = response.status;
           throw err;
        }
        
        const data = await response.json();
        return data.models
          .filter(m => m.supportedGenerationMethods.includes('generateContent'))
          .map(m => ({
            id: m.name.replace('models/', ''),
            name: m.displayName || m.name.replace('models/', '')
          }));
      } catch (error) {
         GeminiErrorHandler.handleError(error);
      }
    });
  }

  async testConnection(apiKey) {
    await this.fetchAvailableModels(apiKey);
    return true;
  }

  _generateLocalResponse() {
    return `[MODO LOCAL – Sin API Key] El trabajo tiene aspectos relevantes y otros que requieren atención.

✅ Aspectos destacados:
  • Has mostrado comprensión de varios conceptos clave.
  • La estructura general de la respuesta es ordenada.

⚠️ Aspectos a reforzar:
  • Revisa los temas en los que tuviste respuestas incorrectas para la próxima evaluación.
  • Profundiza en la explicación de tus decisiones.

Recuerda que puedes consultar en las horas de consulta si tienes dudas específicas.

Saludos,
Profesor(a)`;
  }
}
