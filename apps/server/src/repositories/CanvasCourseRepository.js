import logger from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

export default class CanvasCourseRepository {
  constructor(canvasLmsAdapter) {
    this.adapter = canvasLmsAdapter;
  }

  async getCourses(teacherId) {
    return this.adapter.getCourses(teacherId);
  }

  async getStudents(courseId, teacherId) {
    return this.adapter.getStudents(courseId, teacherId);
  }

  async getAssignments(courseId, teacherId) {
    return this.adapter.getAssignments(courseId, teacherId);
  }

  async getRubric(courseId, assignmentId, teacherId) {
    return this.adapter.getRubric(courseId, assignmentId, teacherId);
  }

  async getSubmission(courseId, assignmentId, studentId, teacherId) {
    return this.adapter.getSubmission(courseId, assignmentId, studentId, teacherId);
  }

  async getStudentGrades(courseId, studentId, teacherId) {
    return this.adapter.getStudentGrades(courseId, studentId, teacherId);
  }

  async postComment(courseId, assignmentId, studentId, teacherId, comment) {
    return this.adapter.postComment(courseId, assignmentId, studentId, teacherId, comment);
  }

  async updateGrade(courseId, assignmentId, studentId, teacherId, grade) {
    return this.adapter.updateGrade(courseId, assignmentId, studentId, teacherId, grade);
  }

  async pushRubricAssessment(courseId, assignmentId, studentId, teacherId, rubricAssessment) {
    return this.adapter.pushRubricAssessment(courseId, assignmentId, studentId, teacherId, rubricAssessment);
  }

  async pushInAppMessage(courseId, studentId, teacherId, subject, bodyText) {
    return this.adapter.pushInAppMessage(courseId, studentId, teacherId, subject, bodyText);
  }
}
