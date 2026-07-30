import IAProvider from "./IAProvider.js";
import logger from '../../utils/logger.js';
import ExponentialBackoff from '../../utils/network/ExponentialBackoff.js';
import ClaudeErrorHandler from './errors/ClaudeErrorHandler.js';

const OUTPUT_GUARDRAILS = `
---
REGLAS DE SALIDA (OBLIGATORIAS):
1. Entrega SOLO el texto de retroalimentación. No expliques lo que harás, no describas la plantilla, no resumas las preguntas.
2. Si vas a mencionar números, usa los datos provistos arriba —no inventes calificaciones.
3. Finaliza con un saludo cordial y tu nombre como profesor.
4. La respuesta debe estar completamente en el idioma solicitado y lista para enviar al estudiante sin modificaciones.`;

export default class ClaudeProvider extends IAProvider {
  constructor(apiKey, customEndpoint = null) {
    super();
    this.apiKey = apiKey;
    this.baseURL = customEndpoint || 'https://api.anthropic.com/v1';
  }

  async generateFeedback(prompt, config = {}) {
    logger.info('[IA] Generando feedback con Claude (con Exponential Backoff)...');

    const apiKey = config.apiKey || this.apiKey;
    if (!apiKey) {
      throw new Error('API Key de Claude requerida');
    }

    const modelName = config.model || "claude-3-5-sonnet-latest";
    const promptConGuardrails = prompt + OUTPUT_GUARDRAILS;

    return await ExponentialBackoff.execute(async () => {
      try {
        const response = await fetch(`${this.baseURL}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
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
          const err = new Error('Claude API Error');
          err.response = { 
            status: response.status, 
            data: errorData,
            headers: Object.fromEntries(response.headers.entries())
          };
          throw err;
        }

        const data = await response.json();
        const text = data.content?.[0]?.text?.trim();

        if (!text) {
          throw new Error('Respuesta vacía de Claude');
        }

        return text;
      } catch (error) {
        ClaudeErrorHandler.handleError(error);
      }
    }, { maxRetries: 3, baseDelay: 1000 });
  }

  async fetchAvailableModels(apiKey) {
    // Anthropic API no provee un endpoint público de /models oficial similar a OpenAI 
    // en la versión 2023-06-01. Sin embargo, recientemente incluyeron un endpoint en beta.
    // Si falla, caemos a un listado estático conocido.
    return await ExponentialBackoff.execute(async () => {
      try {
        const targetKey = apiKey || this.apiKey;
        const response = await fetch(`${this.baseURL}/models`, {
          headers: {
            'x-api-key': targetKey,
            'anthropic-version': '2023-06-01'
          }
        });
        
        if (!response.ok) {
           // Fallback a modelos estáticos si el endpoint falla (ej. por versión)
           if (response.status === 404 || response.status === 401) {
              if (response.status === 401) throw new Error("Invalid API Key");
              return [
                { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet' },
                { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku' },
                { id: 'claude-3-opus-latest', name: 'Claude 3 Opus' }
              ];
           }
           const errorData = await response.json().catch(() => ({}));
           const err = new Error('Error fetch models');
           err.response = { status: response.status, data: errorData };
           throw err;
        }
        
        const data = await response.json();
        return data.data.map(m => ({
          id: m.id,
          name: m.display_name || m.id
        }));
      } catch (error) {
         if (error.message === "Invalid API Key") {
             const err = new Error();
             err.response = { status: 401, data: { error: { message: "Invalid API Key" } } };
             ClaudeErrorHandler.handleError(err);
         }
         ClaudeErrorHandler.handleError(error);
      }
    });
  }

  async testConnection(apiKey) {
    await this.fetchAvailableModels(apiKey);
    return true;
  }
}
