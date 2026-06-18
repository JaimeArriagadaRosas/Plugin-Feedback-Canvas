/**
 * Servicio de Integración con Canvas LMS (Full REST Implementation)
 * Implementa las llamadas necesarias para obtener contexto y persistir feedback.
 */
export default class CanvasService {
  constructor(accessToken, canvasBaseUrl) {
    this.accessToken = accessToken;
    this.canvasBaseUrl = canvasBaseUrl;
  }

  async _fetch(endpoint, options = {}) {
    const response = await fetch(`${this.canvasBaseUrl}/api/v1${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    if (!response.ok) throw new Error(`Canvas API error [${response.status}]: ${response.statusText}`);
    return await response.json();
  }

  // --- Cursos y Tareas ---
  async getCourses() {
    return this._fetch('/courses?enrollment_type=teacher&per_page=50');
  }

  async getStudents(courseId) {
    return this._fetch(`/courses/${courseId}/users?enrollment_type[]=student&per_page=50`);
  }

  async getCourse(courseId) {
    return this._fetch(`/courses/${courseId}`);
  }

  async getAssignments(courseId) {
    return this._fetch(`/courses/${courseId}/assignments?per_page=50`);
  }

  async getAssignment(courseId, assignmentId) {
    return this._fetch(`/courses/${courseId}/assignments/${assignmentId}`);
  }

  // --- Rúbricas y Calificaciones ---
  async getRubric(courseId, assignmentId) {
    const assignment = await this.getAssignment(courseId, assignmentId);
    return assignment.rubric || [];
  }

  async getSubmission(courseId, assignmentId, studentId) {
    return this._fetch(`/courses/${courseId}/assignments/${assignmentId}/submissions/${studentId}?include[]=submission_history&include[]=submission_comments`);
  }

  async getStudentGrades(courseId, studentId) {
    return this._fetch(`/courses/${courseId}/users/${studentId}/enrollments`);
  }

  // --- SpeedGrader / Feedback ---
  async postComment(courseId, assignmentId, studentId, comment) {
    return this._fetch(`/courses/${courseId}/assignments/${assignmentId}/submissions/${studentId}`, {
      method: 'PUT',
      body: JSON.stringify({
        comment: { text_comment: comment }
      })
    });
  }

  async updateGrade(courseId, assignmentId, studentId, grade) {
    return this._fetch(`/courses/${courseId}/assignments/${assignmentId}/submissions/${studentId}`, {
      method: 'PUT',
      body: JSON.stringify({
        submission: { posted_grade: grade }
      })
    });
  }
}
