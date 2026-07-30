import IAProvider from "./IAProvider.js";
import logger from '../../utils/logger.js';
import ExponentialBackoff from '../../utils/network/ExponentialBackoff.js';
import OpenAIErrorHandler from './errors/OpenAIErrorHandler.js';

const OUTPUT_GUARDRAILS = `
---
REGLAS DE SALIDA (OBLIGATORIAS):
1. Entrega SOLO el texto de retroalimentación. No expliques lo que harás, no describas la plantilla, no resumas las preguntas.
2. Si vas a mencionar números, usa los datos provistos arriba —no inventes calificaciones.
3. Finaliza con un saludo cordial y tu nombre como profesor.
4. La respuesta debe estar completamente en el idioma solicitado y lista para enviar al estudiante sin modificaciones.`;

export default class OpenAIProvider extends IAProvider {
  constructor(apiKey, customEndpoint = null) {
    super();
    this.apiKey = apiKey;
    this.baseURL = customEndpoint || 'https://api.openai.com/v1';
  }

  async generateFeedback(prompt, config = {}) {
    logger.info('[IA] Generando feedback con OpenAI (con Exponential Backoff)...');

    const apiKey = config.apiKey || this.apiKey;
    if (!apiKey) {
      throw new Error('API Key de OpenAI requerida');
    }

    const modelName = config.model || "gpt-4o-mini";
    const promptConGuardrails = prompt + OUTPUT_GUARDRAILS;

    return await ExponentialBackoff.execute(async () => {
      try {
        const response = await fetch(`${this.baseURL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: modelName,
            messages: [{ role: 'user', content: promptConGuardrails }],
            temperature: config.temperature || 0.7,
            max_tokens: config.maxOutputTokens || 2048
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const err = new Error('OpenAI API Error');
          err.response = { status: response.status, data: errorData };
          throw err;
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content?.trim();

        if (!text) {
          throw new Error('Respuesta vacía de OpenAI');
        }

        return text;
      } catch (error) {
        OpenAIErrorHandler.handleError(error);
      }
    }, { maxRetries: 3, baseDelay: 1000 });
  }

  async fetchAvailableModels(apiKey) {
    return await ExponentialBackoff.execute(async () => {
      try {
        const targetKey = apiKey || this.apiKey;
        const response = await fetch(`${this.baseURL}/models`, {
          headers: {
            'Authorization': `Bearer ${targetKey}`
          }
        });
        
        if (!response.ok) {
           const errorData = await response.json().catch(() => ({}));
           const err = new Error('Error fetch models');
           err.response = { status: response.status, data: errorData };
           throw err;
        }
        
        const data = await response.json();
        // Filtrar modelos de chat, comúnmente empiezan con gpt-
        return data.data
          .filter(m => m.id.startsWith('gpt-') || m.id.includes('o1') || m.id.includes('o3'))
          .map(m => ({
            id: m.id,
            name: m.id
          }))
          .sort((a, b) => b.id.localeCompare(a.id));
      } catch (error) {
         OpenAIErrorHandler.handleError(error);
      }
    });
  }

  async testConnection(apiKey) {
    await this.fetchAvailableModels(apiKey);
    return true;
  }
}
