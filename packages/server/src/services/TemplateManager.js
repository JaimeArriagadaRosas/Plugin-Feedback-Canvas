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

    return {
      ...template,
      instructionIA: `El estudiante obtuvo ${canvasScore} de ${pointsPossible} puntos en Canvas (nota chilena: ${chileGrade}/7.0, aprobado: ${chileGrade >= 4.0}). Usa un tono ${tone}.`
    };
  }

  /**
   * CRUD delegado al repositorio
   */
  async createTemplate(data) {
    return this.templateRepo.save(data);
  }
}
