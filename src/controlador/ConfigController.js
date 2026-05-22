/**
 * Controlador de Configuración (RF55, RF56)
 */
export default class ConfigController {
  constructor(iaConfigManager) {
    this.iaConfigManager = iaConfigManager;
  }

  async setIAModel(req, res, next) {
    try {
      const { servicio, modelo } = req.body;
      const config = await this.iaConfigManager.updateServiceStatus(servicio, true);
      res.json({ exito: true, mensaje: `Modelo cambiado a ${modelo}`, data: config });
    } catch (error) {
      next(error);
    }
  }

  async getTokens(req, res, next) {
    try {
      const { servicio } = req.query;
      const key = await this.iaConfigManager.tokenRepo.getActiveKey(servicio);
      res.json({ exito: true, data: { servicio, key: '********' } });
    } catch (error) {
      next(error);
    }
  }

  async saveToken(req, res, next) {
    try {
      const { servicio, key } = req.body;
      
      // Validaciones básicas
      if (!servicio || !key) {
        const error = new Error('Servicio y key son requeridos');
        error.statusCode = 400;
        return next(error);
      }

      await this.iaConfigManager.tokenRepo.registerKey(servicio, key);
      
      // RESPUESTA DE ÉXITO: Siempre JSON
      return res.json({ 
        exito: true, 
        mensaje: `Llave para ${servicio} registrada correctamente` 
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
