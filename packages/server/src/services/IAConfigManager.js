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
    const apiKey = await this.tokenRepo.getActiveKey(serviceName);
    
    if (!apiKey) {
      throw new Error(`No se encontró una llave de API activa para el servicio: ${serviceName}`);
    }

    const config = this.configRepo ? await this.configRepo.getConfigIA() : null;
    
    return {
      service: serviceName,
      apiKey: apiKey,
      model: config?.modelo_preferido || 'gemini-1.5-flash',
      maxTokens: config?.longitud_maxima || 2048
    };
  }

  /**
   * Cambia el estado de una llave de API
   */
  async updateServiceStatus(serviceName, isActive) {
    // Lógica para activar/desactivar servicios
    return { success: true, service: serviceName, active: isActive };
  }
}
