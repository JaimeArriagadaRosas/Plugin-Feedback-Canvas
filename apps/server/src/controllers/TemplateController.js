import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/errors.js';

/**
 * Templates Controller (RF09, RF10, RF11)
 */
export default class TemplateController {
  constructor(templateManager) {
    this.templateManager = templateManager;
    this.getAll = asyncHandler(this.getAll.bind(this));
    this.getOne = asyncHandler(this.getOne.bind(this));
    this.create = asyncHandler(this.create.bind(this));
    this.update = asyncHandler(this.update.bind(this));
    this.delete = asyncHandler(this.delete.bind(this));
  }

  async getAll(req, res) {
    const profesorId = req.appIdentity?.canonicalUserId || req.body.profesorId || 'system';
    const templates = await this.templateManager.getTemplatesForProfesor(profesorId);
    res.json({ exito: true, data: templates });
  }

  async getOne(req, res) {
    const template = await this.templateManager.getTemplateById(req.params.id);
    if (!template) throw new ApiError('Template not found', 404);
    res.json({ exito: true, data: template });
  }

  async create(req, res) {
    const profesorId = req.appIdentity?.canonicalUserId || req.body.profesorId || 'system';
    const newTemplate = await this.templateManager.createTemplate(req.body, profesorId);
    res.status(201).json({ exito: true, data: newTemplate });
  }

  async update(req, res) {
    const profesorId = req.appIdentity?.canonicalUserId || req.body.profesorId || 'system';
    const updated = await this.templateManager.updateTemplate(req.params.id, req.body, profesorId);
    if (!updated) throw new ApiError('Template not found or without permissions', 404);
    res.json({ exito: true, data: updated });
  }

  async delete(req, res) {
    const profesorId = req.appIdentity?.canonicalUserId || req.body.profesorId || 'system';
    await this.templateManager.deleteTemplate(req.params.id, profesorId);
    res.json({ exito: true, mensaje: 'Template deleted successfully' });
  }
}
