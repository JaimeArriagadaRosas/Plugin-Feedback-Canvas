import IAProvider from "./IAProvider.js";
import logger from '../../utils/logger.js';
import ExponentialBackoff from '../../utils/network/ExponentialBackoff.js';
import ClaudeErrorHandler from './errors/ClaudeErrorHandler.js';

const OUTPUT_GUARDRAILS = `
---
OUTPUT RULES (MANDATORY):
1. Deliver ONLY the feedback text. Do not explain what you will do, do not describe the template, do not summarize the questions.
2. If you are going to mention numbers, use the data provided above —do not invent grades.
3. End with a cordial greeting and your name as a teacher.
4. The response must be completely in the requested language and ready to send to the student without modifications.`;

export default class ClaudeProvider extends IAProvider {
  constructor(apiKey, customEndpoint = null) {
    super();
    this.apiKey = apiKey;
    this.baseURL = customEndpoint || 'https://api.anthropic.com/v1';
  }

  async generateFeedback(prompt, config = {}) {
    logger.info('[IA] Generating feedback with Claude (with Exponential Backoff)...');

    const apiKey = config.apiKey || this.apiKey;
    if (!apiKey) {
      throw new Error('Claude API Key required');
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
          throw new Error('Empty response from Claude');
        }

        return text;
      } catch (error) {
        ClaudeErrorHandler.handleError(error);
      }
    }, { maxRetries: 3, baseDelay: 1000 });
  }

  async fetchAvailableModels(apiKey) {
    // Anthropic API does not provide an official public /models endpoint similar to OpenAI 
    // in version 2023-06-01. However, they recently included a beta endpoint.
    // If it fails, we fall back to a known static list.
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
           // Fallback to static models if the endpoint fails (e.g. due to version)
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
