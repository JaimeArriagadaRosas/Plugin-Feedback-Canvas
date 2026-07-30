/**
 * Puerto (interface) para el servicio de integración con Canvas LMS.
 * 
 * Documenta el contrato que deben cumplir las implementaciones
 * (CanvasService, CanvasService.local) para que
 * los use cases permanezcan agnósticos del proveedor.
 */
export class ICanvasService {
  constructor(accessToken, canvasBaseUrl) {
    throw new Error('Method not implemented');
  }
  async getCourses() { throw new Error('Method not implemented'); }
  async getStudents(courseId) { throw new Error('Method not implemented'); }
  async getCourse(courseId) { throw new Error('Method not implemented'); }
  async getAssignments(courseId) { throw new Error('Method not implemented'); }
  async getAssignment(courseId, assignmentId) { throw new Error('Method not implemented'); }
  async getRubric(courseId, assignmentId) { throw new Error('Method not implemented'); }
  async getSubmission(courseId, assignmentId, studentId) { throw new Error('Method not implemented'); }
  async getQuizQuestions(courseId, assignmentId) { throw new Error('Method not implemented'); }
  async getStudentGrades(courseId, studentId) { throw new Error('Method not implemented'); }
  async postComment(courseId, assignmentId, studentId, comment) { throw new Error('Method not implemented'); }
  async updateGrade(courseId, assignmentId, studentId, grade) { throw new Error('Method not implemented'); }
}