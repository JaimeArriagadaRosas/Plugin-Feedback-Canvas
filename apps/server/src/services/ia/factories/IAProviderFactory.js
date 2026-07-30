import GeminiProvider from '../GeminiProvider.js';
import OpenAIProvider from '../OpenAIProvider.js';
import ClaudeProvider from '../ClaudeProvider.js';
import CustomProvider from '../CustomProvider.js';

export default class IAProviderFactory {
  /**
   * Crea una instancia del proveedor correspondiente.
   * @param {string} service El nombre del servicio ('gemini', 'openai', 'claude', 'otros', 'custom')
   * @param {string} apiKey La clave de API
   * @param {string} customEndpoint El endpoint (opcional, solo usado por Custom/Otros)
   * @returns {IAProvider}
   */
  static createProvider(service, apiKey, customEndpoint = null) {
    const srv = service.toLowerCase();
    
    switch (srv) {
      case 'gemini':
        return new GeminiProvider(apiKey, customEndpoint);
      case 'openai':
        return new OpenAIProvider(apiKey, customEndpoint);
      case 'claude':
        return new ClaudeProvider(apiKey, customEndpoint);
      case 'otros':
      case 'custom':
        return new CustomProvider(apiKey, customEndpoint);
      default:
        throw new Error(`Proveedor de IA no soportado: ${service}`);
    }
  }
}
