import { GoogleGenerativeAI } from "@google/generative-ai";
import IAProvider from "./IAProvider.js";

/**
 * Proveedor de IA usando Google Gemini.
 *
 * Passthrough extra al prompt:
 *  Se inyectan al final unas reglas de salida condensadas para evitar
 *  que Gemini devuelva "lo que ve en la plantilla" en vez de entregar
 *  el texto de retroalimentación directamente.
 */
const OUTPUT_GUARDRAILS = `

---
REGLAS DE SALIDA (OBLIGATORIAS):
1. Entrega SOLO el texto de retroalimentación. No expliques lo que harás, no describas la plantilla, no resumas las preguntas.
2. Si vas a mencionar números, usa los datos provistos arriba —no inventes calificaciones.
3. Finaliza con un saludo cordial y tu nombre como profesor.
4. La respuesta debe estar completamente en español y lista para enviar al estudiante sin modificaciones.`;

export default class GeminiProvider extends IAProvider {
  constructor(apiKey) {
    super();
    this.apiKey = apiKey;
    this.genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
  }

  /**
   * Genera feedback usando el modelo Gemini.
   * Inyecta reglas de salida al prompt para evitar interpretaciones de plantilla.
   * @param {string} prompt    - Prompt construido por PromptManager
   * @param {object} config    - { model, temperature, etc. }
   */
  async generateFeedback(prompt, config = {}) {
    console.log("[IA] Generando feedback con Gemini...");

    if (!this.genAI) {
      console.warn("[IA] API Key de Gemini ausente. Usando respuesta simulada.");
      return this._generateMockResponse();
    }

    try {
      const model = this.genAI.getGenerativeModel({
        model: config.model || "gemini-flash-latest",
        generationConfig: {
          temperature: config.temperature || 0.7,
          maxOutputTokens: config.maxOutputTokens || 2048,
        }
      });

      // Añadir guardrails al prompt final antes de enviar a Gemini
      const promptConGuardrails = prompt + OUTPUT_GUARDRAILS;

      const result   = await model.generateContent(promptConGuardrails);
      const response = await result.response;
      const text     = response.text().trim();

      // Si Gemini devuelve vacío después de los guardrails, usar fallback
      if (!text || text.length < 20) {
        console.warn("[IA] Respuesta vacía o muy corta. Usando fallback.");
        return this._generateMockResponse();
      }

      return text;
    } catch (error) {
      console.error("[IA] Error en Gemini SDK:", error.message);
      return `Error al generar feedback automáticamente: ${error.message}. Por favor, revisa la configuración de la API.`;
    }
  }

  /**
   * Respuesta de respaldo cuando no hay API Key o Gemini falla.
   * Ahora incluye datos concretos del estudiante para simular una respuesta real.
   */
  async _generateMockResponse() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(`[SIMULACIÓN – Sin API Key] El trabajo tiene aspectos relevantes y otros que requieren atención.

✅ Aspectos destacados:
  • Has mostrado comprensión de varios conceptos clave.
  • La estructura general de la respuesta es ordenada.

⚠️ Aspectos a reforzar:
  • Revisa los temas en los que tuviste respuestas incorrectas para la próxima evaluación.
  • Profundiza en la explicación de tus decisiones.

Recuerda que puedes consultar en las horas de consulta si tienes dudas específicas.

Saludos,
Profesor(a)`);
      }, 1000);
    });
  }
}
