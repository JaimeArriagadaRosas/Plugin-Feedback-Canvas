// services/aiService.js - AI Engine abstraction layer (RF04, RF54, RF55, RF56)
const axios = require('axios');
const aiConfig = require('../config/ai');

class AIService {
  constructor() {
    this.provider = aiConfig.providers[aiConfig.defaultProvider];
    this.prompts = aiConfig.prompts;
    this.gradeRanges = aiConfig.gradeRanges;
  }

  /**
   * Generate feedback based on student context and grade
   * @param {Object} params - Generation parameters
   * @returns {Object} Generated feedback with metadata
   */
  async generateFeedback(params) {
    const {
      studentName,
      grade,
      gradeRange,
      studentContext = {},
      template,
      provider = aiConfig.defaultProvider
    } = params;

    const startTime = Date.now();

    try {
      // Select provider
      const providerConfig = aiConfig.providers[provider] || this.provider;
      
      // Build prompt
      const prompt = this.buildPrompt(gradeRange, studentName, grade, studentContext, template);
      
      // Call the provider
      let result;
      if (provider === 'openai') {
        result = await this.callOpenAI(prompt, providerConfig);
      } else if (provider === 'anthropic') {
        result = await this.callAnthropic(prompt, providerConfig);
      } else if (provider === 'gemini') {
        result = await this.callGemini(prompt, providerConfig);
      } else {
        result = this.getMockResponse(gradeRange, studentName, grade, studentContext);
      }

      const generationTime = Date.now() - startTime;

      return {
        content: result.content,
        modelUsed: provider,
        tokensUsed: result.tokensUsed,
        promptUsed: prompt,
        generationTimeMs: generationTime,
        success: true
      };
    } catch (error) {
      console.error('AI generation error:', error);
      
      // Fallback to mock if AI fails (RF62)
      if (process.env.ENABLE_MOCK_FALLBACK === 'true') {
        return {
          content: this.getMockFeedback(gradeRange, studentName, grade),
          modelUsed: 'mock-fallback',
          tokensUsed: 0,
          generationTimeMs: Date.now() - startTime,
          success: true,
          isFallback: true,
          warning: 'AI service unavailable, using fallback template'
        };
      }
      
      throw error;
    }
  }

  buildPrompt(gradeRange, studentName, grade, studentContext, template) {
    const basePrompt = this.prompts[gradeRange] || this.prompts.needsImprovement;
    
    // Replace placeholders
    let prompt = basePrompt
      .replace('{{nombre_estudiante}}', studentName)
      .replace('{{calificacion}}', grade.toString())
      .replace('{{historial_curricular}}', this.formatHistory(studentContext.history))
      .replace('{{promedio_curso}}', studentContext.courseAverage?.toFixed(1) || 'N/A')
      .replace('{{variables_personalizacion}}', this.formatVariables(studentContext.variables));

    // Add custom template content if provided
    if (template) {
      prompt += `\n\nPlantilla personalizada:\n${template.content}`;
    }

    // Add historical comparison (RF05)
    if (studentContext.history && studentContext.history.length > 0) {
      const avg = studentContext.history.reduce((a, b) => a + b, 0) / studentContext.history.length;
      const trend = grade > avg ? 'mejora' : grade < avg ? 'retroceso' : 'mantiene';
      prompt += `\n\nNota adicional: El estudiante muestra un ${trend} respecto a su promedio histórico (${avg.toFixed(1)}).`;
    }

    return prompt;
  }

  formatHistory(history) {
    if (!history || history.length === 0) return 'Sin historial previo en este curso';
    return `Calificaciones anteriores: ${history.map(g => g.toFixed(1)).join(', ')}`;
  }

  formatVariables(variables) {
    if (!variables) return 'Sin variables adicionales';
    return Object.entries(variables)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
  }

  async callOpenAI(prompt, config) {
    const response = await axios.post(
      config.apiEndpoint,
      {
        model: config.defaultModel,
        messages: [
          {
            role: 'system',
            content: 'Eres un asistente educativo especializado en retroalimentación universitaria.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: config.temperature,
        max_tokens: config.maxTokens
      },
      {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    return {
      content: response.data.choices[0].message.content.trim(),
      tokensUsed: response.data.usage?.total_tokens || 0
    };
  }

  async callAnthropic(prompt, config) {
    const response = await axios.post(
      config.apiEndpoint,
      {
        model: config.defaultModel,
        max_tokens: config.maxTokens,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: config.temperature
      },
      {
        headers: {
          'x-api-key': config.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        timeout: 10000
      }
    );

    return {
      content: response.data.content[0].text.trim(),
      tokensUsed: response.data.usage?.input_tokens + response.data.usage?.output_tokens || 0
    };
  }

  async callGemini(prompt, config) {
    const modelEndpoint = `${config.apiEndpoint}/${config.defaultModel}:generateContent?key=${config.apiKey}`;
    
    const response = await axios.post(
      modelEndpoint,
      {
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          temperature: config.temperature,
          maxOutputTokens: config.maxTokens
        }
      },
      {
        timeout: 10000
      }
    );

    return {
      content: response.data.candidates[0].content.parts[0].text.trim(),
      tokensUsed: response.data.usageMetadata?.totalTokenCount || 0
    };
  }

  getMockResponse(gradeRange, studentName, grade, studentContext) {
    return {
      content: this.getMockFeedback(gradeRange, studentName, grade),
      tokensUsed: 150,
      isMock: true
    };
  }

  getMockFeedback(gradeRange, studentName, grade) {
    const mockTemplates = {
      excellent: `¡Excelente trabajo, ${studentName}! Tu calificación de ${grade} refleja un dominio sobresaliente de los conceptos. Sigue manteniendo este nivel de dedicación y considera compartir tu conocimiento con compañeros que puedan necesitar apoyo. ¡Felicitaciones!`,
      satisfactory: `Buen trabajo, ${studentName}. Has demostrado competencia adecuada con tu calificación de ${grade}. Para mejorar, te recomiendo revisar los materiales de la unidad y practicar con ejercicios adicionales. ¡Puedes lograr más!`,
      needs_improvement: `Hola ${studentName}, veo que tuviste dificultades en esta actividad (calificación: ${grade}). No te desanientes, esto es una oportunidad para aprender. Te sugiero programar una tutoría y revisar los contenidos de la unidad con más detalle. Estoy aquí para ayudarte.`
    };
    
    return mockTemplates[gradeRange] || mockTemplates.needs_improvement;
  }

  /**
   * Switch active AI provider
   */
  setProvider(providerName) {
    if (!aiConfig.providers[providerName]) {
      throw new Error(`Provider ${providerName} not configured`);
    }
    this.provider = aiConfig.providers[providerName];
  }

  /**
   * Get available providers
   */
  getAvailableProviders() {
    return Object.keys(aiConfig.providers).filter(p => {
      if (p === 'mock') return true; // mock always available
      return aiConfig.providers[p].apiKey && aiConfig.providers[p].apiKey.length > 10;
    });
  }

  /**
   * Validate AI service connectivity
   */
  async healthCheck(provider = null) {
    const targetProvider = provider || aiConfig.defaultProvider;
    
    if (targetProvider === 'mock') {
      return { status: 'healthy', provider: 'mock' };
    }

    try {
      const config = aiConfig.providers[targetProvider];
      if (!config || !config.apiKey) {
        return { status: 'unhealthy', reason: 'API key not configured' };
      }

      // Test connectivity with a minimal request
      if (targetProvider === 'openai') {
        await axios.get('https://api.openai.com/v1/models', {
          headers: { 'Authorization': `Bearer ${config.apiKey}` },
          timeout: 5000
        });
      } else if (targetProvider === 'anthropic') {
        // Anthropic doesn't have a simple health endpoint, skip
      } else if (targetProvider === 'gemini') {
        // Gemini uses API key in URL, assume healthy if key exists
      }

      return { status: 'healthy', provider: targetProvider };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        provider: targetProvider, 
        reason: error.message 
      };
    }
  }
}

module.exports = new AIService();
