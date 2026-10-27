import CanvasScorePolicy from './calificaciones/CanvasScorePolicy.js';

export default class TemplateManager {
  constructor(templateRepo) { this.templateRepo = templateRepo; }

  async getTemplateForScore(templateId, canvasScore, pointsPossible) {
    const template = await this.templateRepo.getById(templateId);
    if (!template) return null;
    const result = CanvasScorePolicy.classify(canvasScore, pointsPossible);
    let contenido = template.contenido;
    try {
      const parsed = JSON.parse(template.contenido);
      if (parsed.alto && parsed.medio && parsed.bajo) {
        const names = { alto: parsed.alto, medio: parsed.medio, bajo: parsed.bajo };
        contenido = names[result.range];
      }
    } catch { /* Older, unstructured templates are kept as-is. */ }
    const tone = { alto: 'encouraging', medio: 'constructive', bajo: 'supportive' };
    return {
      ...template,
      contenido,
      scoreRange: result.range,
      instructionIA: 'Canvas score: ' + result.earned + ' de ' + result.possible + ' puntos' +
        '. Utiliza un tono ' + tone[result.range] + '. No conviertas ni asignes calificaciones.'
    };
  }

  async getTemplatesForProfesor(profesorId) {
    let templates = await this.templateRepo.listByProfesor(profesorId);
    const hasSeeded = await this.templateRepo.hasSeededTemplates(profesorId);
    const localePresent = await this.templateRepo.hasLocaleTemplateRecord(profesorId);
    if (!localePresent) {
      await this.templateRepo.cloneDefaultTemplates(profesorId);
    }
    if (!hasSeeded) await this.templateRepo.markTemplatesAsSeeded(profesorId);
    // Another parallel login can finish seeding after the first list call.
    templates = await this.templateRepo.listByProfesor(profesorId);
    const owned = templates.filter(t => t.profesor_id != null && String(t.profesor_id) === String(profesorId));
    return owned.length ? owned : templates.filter(t => t.profesor_id == null || String(t.profesor_id) === String(profesorId));
  }

  async createTemplate(data, profesorId) { return this.templateRepo.save(data, profesorId); }
  async getTemplateById(id) { return this.templateRepo.getById(id); }
  async updateTemplate(id, data, profesorId) { return this.templateRepo.update(id, data, profesorId); }
  async deleteTemplate(id, profesorId) { return this.templateRepo.delete(id, profesorId); }
}
