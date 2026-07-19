import logger from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

export default class CanvasCourseRepository {
  constructor(canvasHttpClient, canvasTokenManager) {
    this.httpClient = canvasHttpClient;
    this.tokenManager = canvasTokenManager;
  }

  async _fetchWithToken(endpoint, teacherId, options = {}) {
    try {
      const token = await this.tokenManager.getValidToken(teacherId);
      return await this.httpClient.apiFetch(endpoint, token, options);
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 401) {
        await this.tokenManager.invalidateToken(teacherId);
      }
      throw error;
    }
  }

  async _fetchAllWithToken(endpoint, teacherId, options = {}) {
    const results = [];
    let nextUrl = `${this.httpClient.canvasBaseUrl}/api/v1${endpoint}`;
    let pageCount = 0;
    const MAX_PAGES = 50;

    while (nextUrl && pageCount < MAX_PAGES) {
      pageCount++;
      const relativePath = nextUrl.replace(`${this.httpClient.canvasBaseUrl}/api/v1`, '');
      
      try {
        const token = await this.tokenManager.getValidToken(teacherId);
        const res = await this.httpClient.apiFetch(relativePath, token, { ...options, method: 'GET', returnFullResponse: true });
        
        const data = await res.json();
        results.push(...(Array.isArray(data) ? data : [data]));
        nextUrl = this.httpClient.getNextLink(res.headers.get('link'));
      } catch (error) {
        if (error instanceof AppError && error.statusCode === 401) {
          await this.tokenManager.invalidateToken(teacherId);
        }
        throw error;
      }
    }

    return results;
  }

  async getCourses(teacherId) {
    // El 'teacherId' (LTI sub) corresponde al lti_id de Canvas, no al uuid.
    // Puesto que estamos usando el token del profesor, 'self' siempre apuntará al usuario correcto.
    const endpoint = `/users/self/courses?enrollment_type=teacher&per_page=50`;
    return this._fetchAllWithToken(endpoint, teacherId);
  }

  async getStudents(courseId, teacherId) {
    return this._fetchAllWithToken(`/courses/${courseId}/users?enrollment_type[]=student&per_page=50`, teacherId);
  }

  async getAssignments(courseId, teacherId) {
    return this._fetchAllWithToken(`/courses/${courseId}/assignments?per_page=50`, teacherId);
  }

  async getRubric(courseId, assignmentId, teacherId) {
    const assignment = await this._fetchWithToken(`/courses/${courseId}/assignments/${assignmentId}`, teacherId);
    return assignment.rubric || [];
  }

  async getStudentGrades(courseId, studentId, teacherId) {
    return this._fetchWithToken(`/courses/${courseId}/users/${studentId}/enrollments`, teacherId);
  }

  async postComment(courseId, assignmentId, studentId, teacherId, comment) {
    return this._fetchWithToken(`/courses/${courseId}/assignments/${assignmentId}/submissions/${studentId}`, teacherId, {
      method: 'PUT',
      body: JSON.stringify({
        comment: { text_comment: comment }
      })
    });
  }

  async updateGrade(courseId, assignmentId, studentId, teacherId, grade) {
    return this._fetchWithToken(`/courses/${courseId}/assignments/${assignmentId}/submissions/${studentId}`, teacherId, {
      method: 'PUT',
      body: JSON.stringify({
        submission: { posted_grade: grade }
      })
    });
  }

  async pushRubricAssessment(courseId, assignmentId, studentId, teacherId, rubricAssessment) {
    logger.info(`[CanvasCourseRepository] Empujando rúbrica para estudiante ${studentId} en tarea ${assignmentId}`);
    return this._fetchWithToken(`/courses/${courseId}/assignments/${assignmentId}/submissions/${studentId}`, teacherId, {
      method: 'PUT',
      body: JSON.stringify({
        rubric_assessment: rubricAssessment
      })
    });
  }

  async pushInAppMessage(courseId, studentId, teacherId, subject, bodyText) {
    logger.info(`[CanvasCourseRepository] Enviando mensaje In-App a ${studentId} por profesor ${teacherId}`);
    return this._fetchWithToken(`/conversations`, teacherId, {
      method: 'POST',
      body: JSON.stringify({
        recipients: [studentId],
        subject: subject,
        body: bodyText,
        context_code: `course_${courseId}`,
        force_new: true
      })
    });
  }
}
