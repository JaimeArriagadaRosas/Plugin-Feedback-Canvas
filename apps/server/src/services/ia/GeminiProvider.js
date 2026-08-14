import { GoogleGenerativeAI } from "@google/generative-ai";
import IAProvider from "./IAProvider.js";
import logger from '../../utils/logger.js';
import ExponentialBackoff from '../../utils/network/ExponentialBackoff.js';
import GeminiErrorHandler from './errors/GeminiErrorHandler.js';

const OUTPUT_GUARDRAILS = `
---
OUTPUT RULES (MANDATORY):
1. Deliver ONLY the feedback text. Do not explain what you will do, do not describe the template, do not summarize the questions.
2. If you are going to mention numbers, use the data provided above —do not invent grades.
3. End with a cordial greeting and your name as a teacher.
4. The response must be completely in the requested language and ready to send to the student without modifications.`;

export default class GeminiProvider extends IAProvider {
  constructor(apiKey, customEndpoint = null) {
    super();
    this.apiKey = apiKey;
    this.customEndpoint = customEndpoint;
  }

  async generateFeedback(prompt, config = {}) {
    logger.info('[IA] Generating feedback with Gemini (with Exponential Backoff)...');

    const apiKey = config.apiKey || this.apiKey;
    if (!apiKey) {
      logger.warn('[IA] Gemini API Key absent. Using local fallback response.');
      return this._generateLocalResponse();
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // If there were a customEndpoint, the official Google Generative AI SDK allows baseURL
    // but it is not formally documented for all cases. We leave the support open:
    if (this.customEndpoint) {
      // genAI.baseURL = this.customEndpoint; // Depende de la versión del SDK
    }

    const modelName = config.model || "gemini-3.5-flash";
    
    // If there is systemInstruction, we attach the mandatory guardrails
    let finalSystemInstruction = config.systemInstruction || '';
    if (finalSystemInstruction) {
      finalSystemInstruction += '\n' + OUTPUT_GUARDRAILS;
    } else {
      finalSystemInstruction = OUTPUT_GUARDRAILS;
    }

    return await ExponentialBackoff.execute(async () => {
      try {
        const modelOptions = {
          model: modelName,
          generationConfig: {
            temperature: config.temperature || 0.7,
            maxOutputTokens: config.maxOutputTokens || 2048,
          }
        };

        if (finalSystemInstruction) {
          modelOptions.systemInstruction = finalSystemInstruction;
        }

        const model = genAI.getGenerativeModel(modelOptions);

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().trim();

        if (!text || text.length < 20) {
          logger.warn('[IA] Empty or very short response. Using local fallback.');
          return this._generateLocalResponse();
        }

        return text;
      } catch (error) {
        GeminiErrorHandler.handleError(error);
      }
    }, { maxRetries: 3, baseDelay: 1000 });
  }

  async fetchAvailableModels(apiKey) {
    // The @google/generative-ai SDK does not have a simple public listModels in all its versions without Google Cloud authentication.
    // We will use direct fetch to the REST API to get the models, or return the known static ones if it fails.
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
    return `[LOCAL MODE – No API Key] The work has relevant aspects and others that require attention.

✅ Highlighted aspects:
  • You have shown an understanding of several key concepts.
  • The general structure of the response is orderly.

⚠️ Aspects to reinforce:
  • Review the topics where you had incorrect answers for the next assessment.
  • Delve deeper into the explanation of your decisions.

Remember that you can consult during office hours if you have specific questions.

Regards,
Teacher`;
  }
}
