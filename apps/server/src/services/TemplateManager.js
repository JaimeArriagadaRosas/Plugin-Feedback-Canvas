/**
 * Template Manager
 * Implements template selection logic by grade range.
 * Now uses Chilean scale (1.0 - 7.0) to decide feedback tone.
 */
import GradeConverter from './calificaciones/GradeConverter.js';

export default class TemplateManager {
  constructor(templateRepo) {
    this.templateRepo = templateRepo;
  }

  /**
   * Selects best template based on Canvas grade and calculates
   * the equivalent Chilean grade for the tone message.
   * @param {number} templateId    - Base template ID
   * @param {number} canvasScore   - Canvas Score (0-100)
   * @param {number} pointsPossible - Maximum exam points
   */
  async getTemplateForScore(templateId, canvasScore, pointsPossible = 100) {
    const template = await this.templateRepo.getById(templateId);
    if (!template) return null;

    const { chileGrade } = GradeConverter.toChileGrade(canvasScore, pointsPossible);

    // Tone is decided by Chilean grade (not Canvas %)
    const tone = GradeConverter.getToneForChileGrade(chileGrade);

    let toneName = 'medio';
    if (chileGrade >= 6.0) toneName = 'alto';
    else if (chileGrade >= 4.0) toneName = 'medio';
    else toneName = 'bajo';

    let contenido = template.contenido;
    try {
      const parsedContent = JSON.parse(template.contenido);
      if (parsedContent.alto && parsedContent.medio && parsedContent.bajo) {
        // eslint-disable-next-line security/detect-object-injection
        contenido = parsedContent[toneName] || parsedContent.medio;
      }
    } catch (e) {
      // Fallback for old plain text templates
    }

    return {
      ...template,
      contenido,
      instructionIA: `The student obtained ${canvasScore} out of ${pointsPossible} points in Canvas (Chilean grade: ${chileGrade}/7.0, passed: ${chileGrade >= 4.0}). Use a ${tone} tone.`
    };
  }

  async getTemplatesForProfesor(profesorId) {
    let templates = await this.templateRepo.listByProfesor(profesorId);
    
    // If teacher hasn't initialized base templates, clone them
    const hasSeeded = await this.templateRepo.hasSeededTemplates(profesorId);
    if (!hasSeeded) {
      await this.templateRepo.cloneDefaultTemplates(profesorId);
      await this.templateRepo.markTemplatesAsSeeded(profesorId);
      templates = await this.templateRepo.listByProfesor(profesorId);
    }
    
    // Return the teacher's own templates (tolerating string/number type differences)
    const owned = templates.filter(t => t.profesor_id != null && String(t.profesor_id) === String(profesorId));
    
    // If there are no own templates (cloning may have failed), include global ones as fallback
    if (owned.length === 0) {
      return templates.filter(t => t.profesor_id == null || String(t.profesor_id) === String(profesorId));
    }
    
    return owned;
  }

  /**
   * CRUD delegated to repository
   */
  async createTemplate(data, profesorId) {
    return this.templateRepo.save(data, profesorId);
  }

  async getTemplateById(id, profesorId = null) {
    // In a full implementation, you could check if the template belongs to the profesorId
    return this.templateRepo.getById(id);
  }

  async updateTemplate(id, data, profesorId) {
    return this.templateRepo.update(id, data, profesorId);
  }

  async deleteTemplate(id, profesorId) {
    return this.templateRepo.delete(id, profesorId);
  }
}
