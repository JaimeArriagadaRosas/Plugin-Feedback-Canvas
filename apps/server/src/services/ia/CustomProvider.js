import IAProvider from "./IAProvider.js";
import logger from '../../utils/logger.js';
import ExponentialBackoff from '../../utils/network/ExponentialBackoff.js';
import CustomErrorHandler from './errors/CustomErrorHandler.js';
import { getCustomFetchConfig } from './CustomProvider.local.js';

const OUTPUT_GUARDRAILS = `
---
REGLAS DE SALIDA (OBLIGATORIAS):
1. Entrega SOLO el texto de retroalimentación. No expliques lo que harás, no describas la plantilla, no resumas las preguntas.
2. Si vas a mencionar números, usa los datos provistos arriba —no inventes calificaciones.
3. Finaliza con un saludo cordial y tu nombre como profesor.
4. La respuesta debe estar completamente en el idioma solicitado y lista para enviar al estudiante sin modificaciones.`;

/**
 * Proveedor para endpoints genéricos u "Otros". 
 * Por defecto asume una API compatible con OpenAI (muy común en Ollama, vLLM, etc).
 */
export default class CustomProvider extends IAProvider {
  constructor(apiKey, customEndpoint) {
    super();
    this.apiKey = apiKey;
    this.baseURL = customEndpoint;
  }

  async generateFeedback(prompt, config = {}) {
    logger.info(`[IA] Generando feedback con Custom Provider en ${this.baseURL}...`);

    if (!this.baseURL) {
      throw new Error('Custom Endpoint no proporcionado para proveedor "Otros"');
    }

    const apiKey = config.apiKey || this.apiKey;
    const modelName = config.model || "custom-model";
    const promptConGuardrails = prompt + OUTPUT_GUARDRAILS;

    // getCustomFetchConfig permite inyectar opciones locales (ej. ignorar SSL en dev)
    const localConfig = getCustomFetchConfig();

    return await ExponentialBackoff.execute(async () => {
      try {
        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) {
           headers['Authorization'] = `Bearer ${apiKey}`;
        }

        const response = await fetch(`${this.baseURL}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: modelName,
            messages: [{ role: 'user', content: promptConGuardrails }],
            temperature: config.temperature || 0.7,
            max_tokens: config.maxOutputTokens || 2048
          }),
          ...localConfig
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const err = new Error('Custom API Error');
          err.response = { 
            status: response.status, 
            data: errorData,
            headers: Object.fromEntries(response.headers.entries())
          };
          throw err;
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content?.trim();

        if (!text) {
          throw new Error('Respuesta vacía del proveedor custom');
        }

        return text;
      } catch (error) {
        CustomErrorHandler.handleError(error);
      }
    }, { maxRetries: 3, baseDelay: 1000 });
  }

  async fetchAvailableModels(apiKey) {
    const localConfig = getCustomFetchConfig();
    return await ExponentialBackoff.execute(async () => {
      try {
        const targetKey = apiKey || this.apiKey;
        const headers = {};
        if (targetKey) {
           headers['Authorization'] = `Bearer ${targetKey}`;
        }
        
        const response = await fetch(`${this.baseURL}/models`, {
          headers,
          ...localConfig
        });
        
        if (!response.ok) {
           const errorData = await response.json().catch(() => ({}));
           const err = new Error('Error fetch custom models');
           err.response = { status: response.status, data: errorData };
           throw err;
        }
        
        const data = await response.json();
        // Intentar parsear el formato estándar de OpenAI `/models`
        if (data && data.data && Array.isArray(data.data)) {
           return data.data.map(m => ({ id: m.id, name: m.id }));
        } else if (Array.isArray(data)) {
           // Ollama tags api format as fallback? Wait, Ollama /api/tags uses diff format.
           // Pero asumimos API compatible con OpenAI para Custom Provider.
           return data.map(m => ({ id: m.id || m.name, name: m.id || m.name }));
        }
        
        return [{ id: 'custom-model', name: 'Modelo Personalizado' }];
      } catch (error) {
         CustomErrorHandler.handleError(error);
      }
    });
  }

  async testConnection(apiKey) {
    await this.fetchAvailableModels(apiKey);
    return true;
  }
}
