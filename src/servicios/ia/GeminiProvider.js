import { GoogleGenerativeAI } from "@google/generative-ai";
import IAProvider from "./IAProvider.js";

/**
 * Proveedor de IA usando Google Gemini (Real Integration)
 */
export default class GeminiProvider extends IAProvider {
  constructor(apiKey) {
    super();
    this.apiKey = apiKey;
    this.genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
  }

  /**
   * Genera feedback usando el modelo Gemini Pro
   */
  async generateFeedback(prompt, config = {}) {
    console.log("[IA] Generando feedback con Gemini...");

    if (!this.genAI) {
      console.warn("[IA] API Key de Gemini ausente. Usando respuesta simulada.");
      return this._generateMockResponse();
    }

    try {
      const model = this.genAI.getGenerativeModel({ 
        model: config.model || "gemini-1.5-flash" 
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error("[IA] Error en Gemini SDK:", error.message);
      return `Error al generar feedback: ${error.message}`;
    }
  }

  /**
   * Respuesta de respaldo en caso de no tener API Key
   */
  async _generateMockResponse() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(`[SIMULACIÓN] El trabajo presenta una estructura sólida. 
Se recomienda mejorar la redacción en el segundo párrafo y profundizar en el análisis de resultados. 
Puntaje estimado: 85/100.`);
      }, 1000);
    });
  }
}
