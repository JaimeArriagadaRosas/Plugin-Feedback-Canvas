import IAProviderFactory from '../services/ia/factories/IAProviderFactory.js';

/**
 * Configuration Controller (RF55, RF56)
 */
export default class ConfigController {
  constructor(iaConfigManager, configRepo) {
    this.iaConfigManager = iaConfigManager;
    this.configRepo = configRepo;
  }

  async setIAModel(req, res, next) {
    try {
      const { servicio, modelo, temperatura, longitud_maxima, endpoint_api } = req.body;
      
      // Update config table
      if (this.configRepo) {
        await this.configRepo.saveConfigIA(modelo, temperatura, longitud_maxima, endpoint_api, req.user?.id || 1, servicio);
      }
      
      const config = await this.iaConfigManager.updateServiceStatus(servicio, true);
      res.json({ exito: true, mensaje: `Model changed to ${modelo}`, data: config });
    } catch (error) {
      next(error);
    }
  }

  async getTokens(req, res, next) {
    try {
      const { servicio } = req.query;
      const hasKey = await this.iaConfigManager.tokenRepo.hasActiveKey(servicio);
      res.json({ exito: true, data: { servicio, key: hasKey ? '********' : null } });
    } catch (error) {
      next(error);
    }
  }

  async getTokenStatus(req, res, next) {
    try {
      const activeServices = await this.iaConfigManager.tokenRepo.getAllActiveServices();
      res.json({ exito: true, data: activeServices });
    } catch (error) {
      next(error);
    }
  }

  async getAvailableModels(req, res, next) {
    try {
      const { servicio } = req.query;
      if (!servicio) {
        return res.status(400).json({ exito: false, error: { mensaje: 'Service is required' } });
      }

      let models = [];
      try {
        const provider = await this.iaConfigManager.getProvider(servicio);
        models = await provider.fetchAvailableModels();
      } catch (err) {
        // Fallback: If no key is configured or the API fails, return static list
        if (servicio === 'openai') {
          models = [
            { id: 'gpt-4o', name: 'GPT-4o' },
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
            { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
          ];
        } else if (servicio === 'anthropic') {
          models = [
            { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
            { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
            { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' }
          ];
        } else if (servicio === 'gemini') {
          models = [
            { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash' },
            { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' },
            { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite' },
            { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro' }
          ];
        }
      }

      // Specific handling for CustomProvider (others) or empty lists
      if (!models || models.length === 0 || servicio === 'otros') {
        if (servicio === 'otros') {
          models = [{ id: 'custom', name: 'Custom Model' }];
        } else {
          // If for some reason it's still empty (no fallback)
          models = [{ id: 'default', name: 'Token configuration missing' }];
        }
      }

      res.json({ exito: true, data: models });
    } catch (error) {
      next(error);
    }
  }

  async saveToken(req, res, next) {
    try {
      const { servicio, key, endpoint_personalizado } = req.body;
      
      // Validaciones básicas
      if (!servicio || !key) {
        const error = new Error('Service and key are required');
        error.statusCode = 400;
        return next(error);
      }

      // Test connection before saving
      const provider = IAProviderFactory.createProvider(servicio, key, endpoint_personalizado);
      await provider.testConnection(key);

      await this.iaConfigManager.tokenRepo.registerKey(servicio, key, endpoint_personalizado);
      
      // SUCCESS RESPONSE: Always JSON
      return res.json({ 
        exito: true, 
        mensaje: `Key for ${servicio} successfully registered and validated` 
      });
      
    } catch (error) {
      // Ensure the error has a statusCode for the ErrorHandler
      if (!error.statusCode) {
        error.statusCode = 500;
      }
      next(error);
    }
  }
}
