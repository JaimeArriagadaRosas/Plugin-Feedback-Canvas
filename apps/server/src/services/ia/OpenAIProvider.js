import IAProvider from "./IAProvider.js";
import logger from '../../utils/logger.js';
import ExponentialBackoff from '../../utils/network/ExponentialBackoff.js';
import OpenAIErrorHandler from './errors/OpenAIErrorHandler.js';

const OUTPUT_GUARDRAILS = `
---
OUTPUT RULES (MANDATORY):
1. Deliver ONLY the feedback text. Do not explain what you will do, do not describe the template, do not summarize the questions.
2. If you are going to mention numbers, use the data provided above —do not invent grades.
3. End with a cordial greeting and your name as a teacher.
4. The response must be completely in the requested language and ready to send to the student without modifications.`;

export default class OpenAIProvider extends IAProvider {
  constructor(apiKey, customEndpoint = null) {
    super();
    this.apiKey = apiKey;
    this.baseURL = customEndpoint || 'https://api.openai.com/v1';
  }

  async generateFeedback(prompt, config = {}) {
    logger.info('[IA] Generating feedback with OpenAI (with Exponential Backoff)...');

    const apiKey = config.apiKey || this.apiKey;
    if (!apiKey) {
      throw new Error('OpenAI API Key required');
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
          throw new Error('Empty response from OpenAI');
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
        // Filter chat models, commonly start with gpt-
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
