import IAProvider from "./IAProvider.js";
import logger from '../../utils/logger.js';
import ExponentialBackoff from '../../utils/network/ExponentialBackoff.js';
import CustomErrorHandler from './errors/CustomErrorHandler.js';
import { getCustomFetchConfig } from './CustomProvider.local.js';

const OUTPUT_GUARDRAILS = `
---
OUTPUT RULES (MANDATORY):
1. Deliver ONLY the feedback text. Do not explain what you will do, do not describe the template, do not summarize the questions.
2. If you are going to mention numbers, use the data provided above —do not invent grades.
3. End with a cordial greeting and your name as a teacher.
4. The response must be completely in the requested language and ready to send to the student without modifications.`;

/**
 * Provider for generic or "Other" endpoints. 
 * By default it assumes an OpenAI-compatible API (very common in Ollama, vLLM, etc).
 */
export default class CustomProvider extends IAProvider {
  constructor(apiKey, customEndpoint) {
    super();
    this.apiKey = apiKey;
    this.baseURL = customEndpoint;
  }

  async generateFeedback(prompt, config = {}) {
    logger.info(`[IA] Generating feedback with Custom Provider at ${this.baseURL}...`);

    if (!this.baseURL) {
      throw new Error('Custom Endpoint not provided for "Other" provider');
    }

    const apiKey = config.apiKey || this.apiKey;
    const modelName = config.model || "custom-model";
    const promptConGuardrails = prompt + OUTPUT_GUARDRAILS;

    // getCustomFetchConfig allows injecting local options (e.g. ignore SSL in dev)
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
            temperature: Number(config.temperature ?? 0.7),
            max_tokens: Number(config.maxOutputTokens ?? 2048)
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
          throw new Error('Empty response from custom provider');
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
        // Try parsing the standard OpenAI /models format
        if (data && data.data && Array.isArray(data.data)) {
           return data.data.map(m => ({ id: m.id, name: m.id }));
        } else if (Array.isArray(data)) {
           // Ollama tags api format as fallback? Wait, Ollama /api/tags uses diff format.
           // But we assume OpenAI-compatible API for Custom Provider.
           return data.map(m => ({ id: m.id || m.name, name: m.id || m.name }));
        }
        
        return [{ id: 'custom-model', name: 'Custom Model' }];
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
