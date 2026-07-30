/**
 * Gestor de Plantillas
 * Implementa la lógica de selección de plantillas por rango de calificación.
 * Ahora usa la escala chilena (1.0–7.0) para decidir el tono del feedback.
 */
import GradeConverter from './calificaciones/GradeConverter.js';

export default class TemplateManager {
  constructor(templateRepo) {
    this.templateRepo = templateRepo;
  }

  /**
   * Selecciona la mejor plantilla basada en la calificación Canvas y calcula
   * la nota chilena equivalente para el mensaje de tono.
   * @param {number} templateId    - ID de la plantilla base
   * @param {number} canvasScore   - Puntaje Canvas (0–100)
   * @param {number} pointsPossible - Puntos máximos del examen
   */
  async getTemplateForScore(templateId, canvasScore, pointsPossible = 100) {
    const template = await this.templateRepo.getById(templateId);
    if (!template) return null;

    const { chileGrade } = GradeConverter.toChileGrade(canvasScore, pointsPossible);

    // El tono se decide por la nota chilena (no por el % de Canvas)
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
      // Fallback para plantillas antiguas en texto plano
    }

    return {
      ...template,
      contenido,
      instructionIA: `El estudiante obtuvo ${canvasScore} de ${pointsPossible} puntos en Canvas (nota chilena: ${chileGrade}/7.0, aprobado: ${chileGrade >= 4.0}). Usa un tono ${tone}.`
    };
  }

  async getTemplatesForProfesor(profesorId) {
    let templates = await this.templateRepo.listByProfesor(profesorId);
    
    // Si el profesor no ha inicializado las plantillas base, las clonamos
    const hasSeeded = await this.templateRepo.hasSeededTemplates(profesorId);
    if (!hasSeeded) {
      await this.templateRepo.cloneDefaultTemplates(profesorId);
      await this.templateRepo.markTemplatesAsSeeded(profesorId);
      templates = await this.templateRepo.listByProfesor(profesorId);
    }
    
    // Retornamos las propias del profesor (tolerando diferencias de tipo string/number)
    const owned = templates.filter(t => t.profesor_id != null && String(t.profesor_id) === String(profesorId));
    
    // Si no hay plantillas propias (clonación pudo fallar), incluir las globales como fallback
    if (owned.length === 0) {
      return templates.filter(t => t.profesor_id == null || String(t.profesor_id) === String(profesorId));
    }
    
    return owned;
  }

  /**
   * CRUD delegado al repositorio
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
