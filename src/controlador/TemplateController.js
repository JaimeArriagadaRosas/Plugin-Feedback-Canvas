/**
 * Controlador de Plantillas (RF09, RF10, RF11)
 */
export default class TemplateController {
  constructor(templateManager) {
    this.templateManager = templateManager;
  }

  async getAll(req, res, next) {
    try {
      const templates = await this.templateManager.templateRepo.listAll();
      res.json({ exito: true, data: templates });
    } catch (error) {
      next(error);
    }
  }

  async getOne(req, res, next) {
    try {
      const template = await this.templateManager.templateRepo.getById(req.params.id);
      res.json({ exito: true, data: template });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const newTemplate = await this.templateManager.createTemplate(req.body);
      res.status(201).json({ exito: true, data: newTemplate });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const updated = await this.templateManager.templateRepo.update(req.params.id, req.body);
      res.json({ exito: true, data: updated });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      await this.templateManager.templateRepo.delete(req.params.id);
      res.json({ exito: true, mensaje: 'Plantilla eliminada correctamente' });
    } catch (error) {
      next(error);
    }
  }
}
