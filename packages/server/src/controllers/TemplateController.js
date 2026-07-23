/**
 * Controlador de Plantillas (RF09, RF10, RF11)
 */
export default class TemplateController {
  constructor(templateManager) {
    this.templateManager = templateManager;
  }

  async getAll(req, res, next) {
    try {
      const profesorId = req.ltiContext?.user || req.body.profesorId || req.user?.id || 'system';
      const templates = await this.templateManager.getTemplatesForProfesor(profesorId);
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
      const profesorId = req.ltiContext?.user || req.body.profesorId || req.user?.id || 'system';
      const newTemplate = await this.templateManager.createTemplate(req.body, profesorId);
      res.status(201).json({ exito: true, data: newTemplate });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const profesorId = req.ltiContext?.user || req.body.profesorId || req.user?.id || 'system';
      const updated = await this.templateManager.templateRepo.update(req.params.id, req.body, profesorId);
      res.json({ exito: true, data: updated });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const profesorId = req.ltiContext?.user || req.body.profesorId || req.user?.id || 'system';
      await this.templateManager.templateRepo.delete(req.params.id, profesorId);
      res.json({ exito: true, mensaje: 'Plantilla eliminada correctamente' });
    } catch (error) {
      next(error);
    }
  }
}
