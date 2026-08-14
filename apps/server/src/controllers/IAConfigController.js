export default class IAConfigController {
  constructor(llmConfigService) {
    this.llmConfigService = llmConfigService;
  }

  async getConfig(req, res, next) {
    try {
      const config = await this.llmConfigService.getConfig();
      res.json({ exito: true, data: config });
    } catch (error) {
      next(error);
    }
  }

  async updateConfig(req, res, next) {
    try {
      const { modelo_preferido, prompt_base } = req.body;
      const updated = await this.llmConfigService.updateConfig(modelo_preferido, prompt_base);
      res.json({ exito: true, mensaje: 'Configuration updated', data: updated });
    } catch (error) {
      next(error);
    }
  }
}
