import logger from '../utils/logger.js';
import { AppError } from '../utils/errors.js';
import { ExponentialBackoff } from '../utils/ExponentialBackoff.js';

import CourseFacade from './canvas/CourseFacade.js';
import SubmissionFacade from './canvas/SubmissionFacade.js';
import MessageFacade from './canvas/MessageFacade.js';
import AssignmentFacade from './canvas/AssignmentFacade.js';

/**
 * Patrón Facade para centralizar y orquestar las llamadas a la API de Canvas.
 * Delega en sub-fachadas para respetar el Principio de Responsabilidad Única.
 * Elimina la lógica _local, la cual será implementada en CanvasLmsAdapter.local.js mediante herencia.
 */
export default class CanvasLmsAdapter {
  constructor(canvasHttpClient, canvasTokenManager, env) {
    this.httpClient = canvasHttpClient;
    this.tokenManager = canvasTokenManager;

    // Sub-fachadas inyectadas
    this.courseApi = new CourseFacade(this);
    this.submissionApi = new SubmissionFacade(this);
    this.messageApi = new MessageFacade(this);
    this.assignmentApi = new AssignmentFacade(this);
  }

  /**
   * Resuelve el token. Puede ser sobrescrito por clases hijas (ej. CanvasLmsAdapter.local.js)
   */
  async resolveToken(teacherId) {
    return await this.tokenManager.getValidToken(teacherId);
  }

  /**
   * Realiza una petición GET/POST/PUT sencilla usando Exponential Backoff.
   */
  async _fetchWithToken(endpoint, teacherId, options = {}) {
    return ExponentialBackoff.execute(async () => {
      const token = await this.resolveToken(teacherId);
      
      try {
        const response = await this.httpClient.apiFetch(endpoint, token, options);
        // Retornamos el JSON. El httpClient.apiFetch ya lanza AppError si el status no es OK.
        return response;
      } catch (error) {
        if (error instanceof AppError && error.statusCode === 401) {
          logger.error(`[CanvasLmsAdapter] 401 recibido en _fetchWithToken para ${teacherId}. Revocando acceso.`);
          await this.tokenManager.invalidateToken(teacherId);
          throw new AppError('Sesión LTI expirada o revocada por el LMS. Por favor, recargue el plugin.', 401);
        }
        throw error;
      }
    }, `Canvas_Fetch_${endpoint}`);
  }

  /**
   * Realiza peticiones paginadas usando Exponential Backoff.
   */
  async _fetchAllWithToken(endpoint, teacherId, options = {}) {
    const results = [];
    let nextUrl = `${this.httpClient.canvasBaseUrl}/api/v1${endpoint}`;
    let pageCount = 0;
    const MAX_PAGES = 50;

    let token;
    try {
      token = await this.resolveToken(teacherId);
    } catch (tokenErr) {
      logger.error(`[CanvasLmsAdapter] Error obteniendo token para ${teacherId}: ${tokenErr.message}`);
      throw tokenErr;
    }

    while (nextUrl && pageCount < MAX_PAGES) {
      pageCount++;
      const relativePath = nextUrl.replace(`${this.httpClient.canvasBaseUrl}/api/v1`, '');
      
      await ExponentialBackoff.execute(async () => {
        try {
          const res = await this.httpClient.apiFetch(relativePath, token, { ...options, method: 'GET', returnFullResponse: true });
          const data = await res.json();
          results.push(...(Array.isArray(data) ? data : [data]));
          nextUrl = this.httpClient.getNextLink(res.headers.get('link'));
        } catch (error) {
          if (error instanceof AppError && error.statusCode === 401) {
            logger.error(`[CanvasLmsAdapter] 401 recibido en _fetchAllWithToken para ${teacherId}. Revocando acceso.`);
            await this.tokenManager.invalidateToken(teacherId);
            throw new AppError('Sesión LTI expirada o revocada por el LMS. Por favor, recargue el plugin.', 401);
          }
          throw error;
        }
      }, `Canvas_FetchAll_${relativePath}`);
    }

    return results;
  }

  // =========================================================
  // Métodos expuestos al resto de la aplicación (Delegación a Sub-fachadas)
  // =========================================================

  async getCourses(teacherId) {
    return this.courseApi.getCourses(teacherId);
  }

  async getStudents(courseId, teacherId) {
    return this.courseApi.getStudents(courseId, teacherId);
  }

  async getTeachers(courseId, teacherId) {
    return this.courseApi.getTeachers(courseId, teacherId);
  }

  async getAssignments(courseId, teacherId) {
    return this.assignmentApi.getAssignments(courseId, teacherId);
  }
  
  async getAssignment(courseId, assignmentId, teacherId) {
    return this.assignmentApi.getAssignment(courseId, assignmentId, teacherId);
  }

  async getRubric(courseId, assignmentId, teacherId) {
    return this.assignmentApi.getRubric(courseId, assignmentId, teacherId);
  }
  
  async getQuizQuestions(courseId, assignmentId, teacherId) {
    return this.assignmentApi.getQuizQuestions(courseId, assignmentId, teacherId);
  }
  
  async getSubmission(courseId, assignmentId, studentId, teacherId) {
    return this.submissionApi.getSubmission(courseId, assignmentId, studentId, teacherId);
  }

  async getAssignmentSubmissions(courseId, assignmentId, teacherId) {
    return this.submissionApi.getAssignmentSubmissions(courseId, assignmentId, teacherId);
  }

  async getStudentSubmissions(courseId, studentId, teacherId) {
    return this.submissionApi.getStudentSubmissions(courseId, studentId, teacherId);
  }

  async getStudentGrades(courseId, studentId, teacherId) {
    return this.submissionApi.getStudentGrades(courseId, studentId, teacherId);
  }

  async postComment(courseId, assignmentId, studentId, teacherId, comment) {
    return this.submissionApi.postComment(courseId, assignmentId, studentId, teacherId, comment);
  }

  async updateGrade(courseId, assignmentId, studentId, teacherId, grade) {
    return this.submissionApi.updateGrade(courseId, assignmentId, studentId, teacherId, grade);
  }

  async pushRubricAssessment(courseId, assignmentId, studentId, teacherId, rubricAssessment) {
    return this.submissionApi.pushRubricAssessment(courseId, assignmentId, studentId, teacherId, rubricAssessment);
  }

  async pushInAppMessage(courseId, studentId, teacherId, subject, bodyText) {
    return this.messageApi.pushInAppMessage(courseId, studentId, teacherId, subject, bodyText);
  }
}
