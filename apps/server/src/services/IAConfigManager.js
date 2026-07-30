import IAProviderFactory from './ia/factories/IAProviderFactory.js';

/**
 * Gestor de Configuración IA
 * Maneja la selección de modelos y la recuperación segura de llaves de API.
 */
export default class IAConfigManager {
  constructor(tokenRepo, configRepo) {
    this.tokenRepo = tokenRepo;
    this.configRepo = configRepo;
  }

  /**
   * Obtiene la configuración activa para un servicio (ej. 'gemini')
   */
  async getActiveConfig(serviceName) {
    const keyData = await this.tokenRepo.getActiveKey(serviceName);
    
    if (!keyData || !keyData.apiKey) {
      throw new Error(`No se encontró una llave de API activa para el servicio: ${serviceName}`);
    }

    const config = this.configRepo ? await this.configRepo.getConfigIA() : null;
    
    return {
      service: serviceName,
      apiKey: keyData.apiKey,
      customEndpoint: keyData.customEndpoint,
      model: config?.modelo_preferido || 'gemini-3.5-flash',
      maxTokens: config?.longitud_maxima || 2048
    };
  }

  /**
   * Devuelve el proveedor instanciado para el servicio dado
   */
  async getProvider(serviceName) {
    const config = await this.getActiveConfig(serviceName);
    return IAProviderFactory.createProvider(config.service, config.apiKey, config.customEndpoint);
  }

  /**
   * Cambia el estado de una llave de API
   */
  async updateServiceStatus(serviceName, isActive) {
    // Lógica para activar/desactivar servicios
    return { success: true, service: serviceName, active: isActive };
  }
}
