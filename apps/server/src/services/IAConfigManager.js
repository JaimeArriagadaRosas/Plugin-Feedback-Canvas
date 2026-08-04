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
   * Obtiene la configuración activa global usando la DB como fuente de la verdad
   */
  async getGlobalActiveConfig() {
    const config = this.configRepo ? await this.configRepo.getConfigIA() : null;
    const serviceName = config?.proveedor_preferido || 'gemini';
    return this.getActiveConfig(serviceName);
  }

  /**
   * Obtiene la configuración activa para un servicio dado
   */
  async getActiveConfig(serviceName) {
    const keyData = await this.tokenRepo.getActiveKey(serviceName);
    
    // Si se solicitó un proveedor específico y no tiene llave, fallamos
    if (!keyData || !keyData.apiKey) {
      throw new Error(`No se encontró una llave de API activa para el servicio: ${serviceName}`);
    }

    const config = this.configRepo ? await this.configRepo.getConfigIA() : null;
    
    return {
      service: serviceName,
      apiKey: keyData.apiKey,
      customEndpoint: keyData.customEndpoint,
      model: config?.modelo_preferido || 'gemini-3.5-flash',
      maxTokens: config?.longitud_maxima ? parseInt(config.longitud_maxima, 10) : 2048,
      temperature: config?.temperatura !== undefined && config?.temperatura !== null ? parseFloat(config.temperatura) : 0.7
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
