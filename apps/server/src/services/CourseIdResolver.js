import { AppError } from '../utils/errors.js';
import logger from '../utils/logger.js';

export default class CourseIdResolver {
  /**
   * Resuelve el ID del curso. 
   * Si no se provee, intenta obtenerlo de las variables de entorno como fallback (DESIGN-05).
   * 
   * @param {string|null|undefined} courseId 
   * @param {string|null} studentId Para propósitos de logging
   * @returns {string|null} El courseId resuelto o null si no se puede resolver
   */
  static resolve(courseId, studentId = null) {
    if (!courseId || courseId === 'undefined' || courseId === 'null') {
      const envCourseId = process.env.CANVAS_COURSE_ID || process.env.VITE_CANVAS_COURSE_ID;
      if (!envCourseId) {
        if (studentId) {
          logger.warn(`[CourseIdResolver] No courseId provided and no fallback found for student ${studentId}.`);
        }
        return null;
      }
      return envCourseId;
    }
    return courseId;
  }
}
