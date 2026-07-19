import logger from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

export default class CanvasLmsAdapter {
  constructor(canvasHttpClient, canvasTokenManager, env) {
    this.httpClient = canvasHttpClient;
    this.tokenManager = canvasTokenManager;
    this.useLocalData = env.useLocalData;
    this.localService = null;
  }

  async _getLocalService() {
    if (!this.localService) {
      const { default: CanvasServiceLocal } = await import('../services/infrastructure/CanvasService_local.js');
      this.localService = new CanvasServiceLocal();
    }
    return this.localService;
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
    if (this.useLocalData) return (await this._getLocalService()).getCourses(teacherId);
    return this._fetchAllWithToken(`/users/self/courses?enrollment_type=teacher&per_page=50`, teacherId);
  }

  async getStudents(courseId, teacherId) {
    if (this.useLocalData) return (await this._getLocalService()).getStudents(courseId);
    return this._fetchAllWithToken(`/courses/${courseId}/users?enrollment_type[]=student&per_page=50`, teacherId);
  }

  async getAssignments(courseId, teacherId) {
    if (this.useLocalData) return (await this._getLocalService()).getAssignments(courseId);
    return this._fetchAllWithToken(`/courses/${courseId}/assignments?per_page=50`, teacherId);
  }
  
  async getAssignment(courseId, assignmentId, teacherId) {
    if (this.useLocalData) return (await this._getLocalService()).getAssignment(courseId, assignmentId);
    return this._fetchWithToken(`/courses/${courseId}/assignments/${assignmentId}`, teacherId);
  }

  async getRubric(courseId, assignmentId, teacherId) {
    if (this.useLocalData) return (await this._getLocalService()).getRubric(courseId, assignmentId);
    const assignment = await this._fetchWithToken(`/courses/${courseId}/assignments/${assignmentId}`, teacherId);
    return assignment.rubric || [];
  }
  
  async getQuizQuestions(courseId, assignmentId, teacherId) {
    if (this.useLocalData) return (await this._getLocalService()).getQuizQuestions(courseId, assignmentId);
    const quizzes = await this._fetchAllWithToken(`/courses/${courseId}/quizzes`, teacherId);
    const quiz = quizzes.find(q => q.assignment_id == assignmentId);
    if (!quiz) return [];
    return this._fetchAllWithToken(`/courses/${courseId}/quizzes/${quiz.id}/questions`, teacherId);
  }
  
  async getSubmission(courseId, assignmentId, studentId, teacherId) {
    if (this.useLocalData) return (await this._getLocalService()).getSubmission(courseId, assignmentId, studentId);
    return this._fetchWithToken(`/courses/${courseId}/assignments/${assignmentId}/submissions/${studentId}`, teacherId);
  }

  async getStudentGrades(courseId, studentId, teacherId) {
    if (this.useLocalData) return (await this._getLocalService()).getStudentGrades(courseId, studentId);
    return this._fetchWithToken(`/courses/${courseId}/users/${studentId}/enrollments`, teacherId);
  }

  async postComment(courseId, assignmentId, studentId, teacherId, comment) {
    if (this.useLocalData) return (await this._getLocalService()).postComment(courseId, assignmentId, studentId, teacherId, comment);
    return this._fetchWithToken(`/courses/${courseId}/assignments/${assignmentId}/submissions/${studentId}`, teacherId, {
      method: 'PUT',
      body: JSON.stringify({ comment: { text_comment: comment } })
    });
  }

  async updateGrade(courseId, assignmentId, studentId, teacherId, grade) {
    if (this.useLocalData) return (await this._getLocalService()).updateGrade(courseId, assignmentId, studentId, teacherId, grade);
    return this._fetchWithToken(`/courses/${courseId}/assignments/${assignmentId}/submissions/${studentId}`, teacherId, {
      method: 'PUT',
      body: JSON.stringify({ submission: { posted_grade: grade } })
    });
  }

  async pushRubricAssessment(courseId, assignmentId, studentId, teacherId, rubricAssessment) {
    if (this.useLocalData) return (await this._getLocalService()).pushRubricAssessment(courseId, assignmentId, studentId, teacherId, rubricAssessment);
    logger.info(`[CanvasLmsAdapter] Empujando rúbrica para estudiante ${studentId} en tarea ${assignmentId}`);
    return this._fetchWithToken(`/courses/${courseId}/assignments/${assignmentId}/submissions/${studentId}`, teacherId, {
      method: 'PUT',
      body: JSON.stringify({ rubric_assessment: rubricAssessment })
    });
  }

  async pushInAppMessage(courseId, studentId, teacherId, subject, bodyText) {
    if (this.useLocalData) return (await this._getLocalService()).pushInAppMessage(courseId, studentId, teacherId, subject, bodyText);
    logger.info(`[CanvasLmsAdapter] Enviando mensaje In-App a ${studentId} por profesor ${teacherId}`);
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
