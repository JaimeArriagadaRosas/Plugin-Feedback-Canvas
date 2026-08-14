import { CourseVariables, DEFAULT_VARIABLES } from '../../domain/variables/CourseVariables.js';
import VariablesConfigRepository from '../../repositories/VariablesConfigRepository.js';

export default class CourseVariablesService {
  constructor() {
    this.repository = new VariablesConfigRepository();
  }

  /**
   * Gets variable configuration for a given course.
   * Returns default values if there is no previous configuration.
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
   * Validates and saves variable configuration for a course.
   * @param {string|number} courseId 
   * @param {Object} variablesObj 
   */
  async saveCourseVariables(courseId, variablesObj) {
    const validated = CourseVariables.validate(variablesObj);
    return await this.repository.saveForCourse(courseId, validated);
  }
}
