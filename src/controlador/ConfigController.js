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
      await this.iaConfigManager.tokenRepo.registerKey(servicio, key);
      res.json({ exito: true, mensaje: `Llave para ${servicio} registrada correctamente` });
    } catch (error) {
      next(error);
    }
  }
}
