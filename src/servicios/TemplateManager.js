/**
 * Gestor de Plantillas
 * Implementa la lógica de selección de plantillas por rango de calificación.
 */
export default class TemplateManager {
  constructor(templateRepo) {
    this.templateRepo = templateRepo;
  }

  /**
   * Selecciona la mejor plantilla basada en la calificación obtenida
   * @param {number} score - Calificación (0-100)
   * @param {number} templateId - ID base de la plantilla o grupo
   */
  async getTemplateForScore(templateId, score) {
    // En una implementación real, buscaríamos en la DB por rango.
    // Aquí simulamos la lógica:
    const template = await this.templateRepo.getById(templateId);
    
    let tone = 'neutral';
    if (score >= 90) tone = 'motivador y avanzado';
    else if (score < 60) tone = 'constructivo y de apoyo';
    else tone = 'estándar y equilibrado';

    return {
      ...template,
      instructionIA: `El estudiante obtuvo ${score}. Usa un tono ${tone}.`
    };
  }

  /**
   * CRUD delegado al repositorio
   */
  async createTemplate(data) {
    return this.templateRepo.save(data);
  }
}
