// capa-servicios/CanvasService.js
// Implementación de la integración con la API REST de Canvas LMS

export default class CanvasService {
  constructor(accessToken, canvasBaseUrl) {
    this.accessToken = accessToken;
    this.canvasBaseUrl = canvasBaseUrl;
  }

  async getCourses() {
    // TODO: Implement actual API call to /api/v1/courses
    return [];
  }

  async getAssignments(courseId) {
    // TODO: Implement actual API call to /api/v1/courses/:courseId/assignments
    return [];
  }

  async insertRubricComment(courseId, assignmentId, studentId, comment) {
    // TODO: Implement actual API call to insert rubric comment
    return { success: true };
  }
}
