// capa-servicios/ia/GeminiProvider.js
import IAProvider from "./IAProvider";

export default class GeminiProvider extends IAProvider {
  async generateFeedback(prompt, config) {
    // Implementación usando Google Generative AI SDK
    console.log("Generating feedback with Gemini...", prompt);
    return "Feedback generado por Gemini: " + prompt.substring(0, 50) + "...";
  }
}
