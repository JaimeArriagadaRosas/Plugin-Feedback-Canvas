import { CourseVariables, DEFAULT_VARIABLES } from '../../domain/variables/CourseVariables.js';
import VariablesConfigRepository from '../../repositories/VariablesConfigRepository.js';

export default class CourseVariablesService {
  constructor() {
    this.repository = new VariablesConfigRepository();
  }

  /**
   * Obtiene la configuración de variables para un curso dado.
   * Retorna los valores por defecto si no hay configuración previa.
   * @param {string|number} courseId 
   */
  async getCourseVariables(courseId) {
    const config = await this.repository.getByCourseId(courseId);
    if (!config) {
      return DEFAULT_VARIABLES;
    }
    return config;
  }

  /**
   * Valida y guarda la configuración de variables para un curso.
   * @param {string|number} courseId 
   * @param {Object} variablesObj 
   */
  async saveCourseVariables(courseId, variablesObj) {
    const validated = CourseVariables.validate(variablesObj);
    return await this.repository.saveForCourse(courseId, validated);
  }
}
