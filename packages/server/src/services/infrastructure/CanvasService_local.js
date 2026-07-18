import logger from '../../utils/logger.js';
import { getSharedCourses, getSharedAssignments, getSharedRubric, getSharedQuizQuestions, getSharedStudents, buildSharedSubmission, getSharedStudentGrades } from './CanvasService.sharedData.js';

export default class CanvasServiceLocal {
  constructor(accessToken, canvasBaseUrl) {
    this.accessToken = accessToken;
    this.canvasBaseUrl = canvasBaseUrl;
  }

  async getCourses(userId) {
    logger.info(`[LOCAL-CANVAS] getCourses llamado con userId: ${userId || 'N/A'}`);
    return getSharedCourses();
  }

  async getAssignments(courseId) {
    return getSharedAssignments(courseId);
  }

  async getAssignment(courseId, assignmentId) {
    const list = await getSharedAssignments(courseId);
    const found = list.find(a => a.id === assignmentId);
    return found || { id: assignmentId, name: `Tarea ${assignmentId}`, points_possible: 100, description: '' };
  }

  async getRubric(courseId, assignmentId) {
    return getSharedRubric();
  }

  async getQuizQuestions(courseId, assignmentId) {
    return getSharedQuizQuestions(assignmentId);
  }

  async getSubmission(courseId, assignmentId, studentId) {
    return buildSharedSubmission(courseId, assignmentId, studentId);
  }

  async getStudentGrades(courseId, studentId) {
    return getSharedStudentGrades(studentId);
  }

  async getStudents(courseId) {
    return getSharedStudents();
  }

  async postComment(courseId, assignmentId, studentId, comment) {
    console.log(`[LOCAL-CANVAS] Comentario enviado para estudiante ${studentId}: ${comment.substring(0, 60)}...`);
    return { success: true };
  }

  async updateGrade(courseId, assignmentId, studentId, grade) {
    console.log(`[LOCAL-CANVAS] Calificación actualizada para estudiante ${studentId} en tarea ${assignmentId}: ${grade}`);
    return { success: true };
  }
}
