import IAProviderFactory from './ia/factories/IAProviderFactory.js';

/**
 * AI Configuration Manager
 * Handles model selection and secure retrieval of API keys.
 */
export default class IAConfigManager {
  constructor(tokenRepo, configRepo) {
    this.tokenRepo = tokenRepo;
    this.configRepo = configRepo;
  }

  /**
   * Gets the global active configuration using the DB as the source of truth
   */
  async getGlobalActiveConfig() {
    const config = this.configRepo ? await this.configRepo.getConfigIA() : null;
    const serviceName = config?.proveedor_preferido || 'gemini';
    return this.getActiveConfig(serviceName);
  }

  /**
   * Gets the active configuration for a given service
   */
  async getActiveConfig(serviceName) {
    const keyData = await this.tokenRepo.getActiveKey(serviceName);
    
    // If a specific provider was requested and does not have a key, we fail
    if (!keyData || !keyData.apiKey) {
      throw new Error(`No active API key found for the service: ${serviceName}`);
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
   * Returns the instantiated provider for the given service
   */
  async getProvider(serviceName) {
    const config = await this.getActiveConfig(serviceName);
    return IAProviderFactory.createProvider(config.service, config.apiKey, config.customEndpoint);
  }

  /**
   * Changes the state of an API key
   */
  async updateServiceStatus(serviceName, isActive) {
    // Logic to activate/deactivate services
    return { success: true, service: serviceName, active: isActive };
  }
}
