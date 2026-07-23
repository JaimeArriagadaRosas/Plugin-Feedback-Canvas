import logger from '../../utils/logger.js';
import { getSharedCourses, getSharedAssignments, getSharedRubric, getSharedQuizQuestions, getSharedStudents, buildSharedSubmission, getSharedStudentGrades } from './CanvasService.sharedData.js';

export default class CanvasServiceLocal {
  constructor(accessToken, canvasBaseUrl) {
    this.accessToken = accessToken;
    this.canvasBaseUrl = canvasBaseUrl;
  }

  async getCourses(userId) {
    logger.info(`[LOCAL-CANVAS] getCourses llamado con userId: ${userId || 'N/A'}`);
    return getSharedCourses(userId);
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

  async postComment(courseId, assignmentId, studentId, teacherId, comment) {
    console.log(`[LOCAL-CANVAS] Comentario enviado para estudiante ${studentId}: ${comment.substring(0, 60)}...`);
    return { success: true };
  }

  async updateGrade(courseId, assignmentId, studentId, teacherId, grade) {
    console.log(`[LOCAL-CANVAS] Calificación actualizada para estudiante ${studentId} en tarea ${assignmentId}: ${grade}`);
    return { success: true };
  }

  async pushRubricAssessment(courseId, assignmentId, studentId, teacherId, rubricAssessment) {
    console.log(`[LOCAL-CANVAS] Rúbrica enviada para estudiante ${studentId}.`);
    return { success: true };
  }

  async pushInAppMessage(courseId, studentId, teacherId, subject, bodyText) {
    console.log(`[LOCAL-CANVAS] Mensaje in-app enviado a ${studentId}: ${subject}`);
    return { success: true };
  }
}
