import logger from '../utils/logger.js';

export default class CourseIdResolver {
  /**
   * Resolves the course identifier.
   * When absent, tries the environment variables as a fallback (DESIGN-05).
   * 
   * @param {string|null|undefined} courseId 
   * @param {string|null} studentId For logging purposes
   * @returns {string|null} Resolved courseId or null when it cannot be resolved
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
