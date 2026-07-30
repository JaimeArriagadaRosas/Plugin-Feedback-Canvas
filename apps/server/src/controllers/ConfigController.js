import IAProviderFactory from '../services/ia/factories/IAProviderFactory.js';

/**
 * Controlador de Configuración (RF55, RF56)
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
        await this.configRepo.saveConfigIA(modelo, temperatura, longitud_maxima, endpoint_api, req.user?.id || 1);
      }
      
      const config = await this.iaConfigManager.updateServiceStatus(servicio, true);
      res.json({ exito: true, mensaje: `Modelo cambiado a ${modelo}`, data: config });
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

  async getAvailableModels(req, res, next) {
    try {
      const { servicio } = req.query;
      if (!servicio) {
        return res.status(400).json({ exito: false, error: { mensaje: 'Servicio es requerido' } });
      }

      let models = [];
      try {
        const provider = await this.iaConfigManager.getProvider(servicio);
        models = await provider.fetchAvailableModels();
      } catch (err) {
        // Fallback: Si no hay llave configurada o la API falla, devolver lista estática
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
            { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' },
            { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
            { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' }
          ];
        }
      }

      // Manejo específico para CustomProvider (otros) o listas vacías
      if (!models || models.length === 0 || servicio === 'otros') {
        if (servicio === 'otros') {
          models = [{ id: 'custom', name: 'Modelo Personalizado' }];
        } else {
          // Si por alguna razón sigue vacío (no hubo fallback)
          models = [{ id: 'default', name: 'Falta configurar token' }];
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
        const error = new Error('Servicio y key son requeridos');
        error.statusCode = 400;
        return next(error);
      }

      // Probar conexión antes de guardar
      const provider = IAProviderFactory.createProvider(servicio, key, endpoint_personalizado);
      await provider.testConnection(key);

      await this.iaConfigManager.tokenRepo.registerKey(servicio, key, endpoint_personalizado);
      
      // RESPUESTA DE ÉXITO: Siempre JSON
      return res.json({ 
        exito: true, 
        mensaje: `Llave para ${servicio} registrada y validada correctamente` 
      });
      
    } catch (error) {
      // Asegurar que el error tenga statusCode para el ErrorHandler
      if (!error.statusCode) {
        error.statusCode = 500;
      }
      next(error);
    }
  }
}
