import logger from '../utils/logger.js';
import { AppError } from '../utils/errors.js';
import identityResolver from '../services/auth/IdentityResolver.js';

export default class CanvasLmsAdapter {
  constructor(canvasHttpClient, canvasTokenManager, env) {
    this.httpClient = canvasHttpClient;
    this.tokenManager = canvasTokenManager;
    this.useLocalData = env.useLocalData || process.env.STARTUP_MODE === '4';
    this.localService = null;
  }

  async _resolveLocalToken(teacherId) {
    try {
      const token = await this.tokenManager.getValidToken(teacherId);
      if (token) return token;
    } catch (e) {
      logger.warn(`[CanvasLmsAdapter] No se encontró token en BD para sub ${teacherId}.`);
    }
    return null;
  }

  async _getLocalService() {
    if (!this.localService) {
      const { default: CanvasServiceLocal } = await import('../services/infrastructure/CanvasService_local.js');
      this.localService = new CanvasServiceLocal();
    }
    return this.localService;
  }

  async _mapLocalId(teacherId, method) {
    const numericId = await identityResolver.resolveNumericId(teacherId);
    logger.info(`[CanvasLmsAdapter] ${method} - Identidad LTI resuelta (localData): ${teacherId} -> ${numericId}`);
    return numericId;
  }

  async _fetchWithToken(endpoint, teacherId, options = {}, isRetry = false) {
    const isLocalMode = process.env.STARTUP_MODE === '3';
    try {
      const token = isLocalMode
        ? await this._resolveLocalToken(teacherId)
        : await this.tokenManager.getValidToken(teacherId);
      return await this.httpClient.apiFetch(endpoint, token, options);
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 401) {
        if (!isRetry && !isLocalMode) {
          logger.warn(`[CanvasLmsAdapter] 401 recibido en _fetchWithToken para ${teacherId}. Intentando forzar refresh...`);
          try {
            await this.tokenManager.forceRefresh(teacherId);
            return await this._fetchWithToken(endpoint, teacherId, options, true);
          } catch (refreshError) {
            await this.tokenManager.invalidateToken(teacherId);
            throw refreshError;
          }
        } else if (!isLocalMode) {
          await this.tokenManager.invalidateToken(teacherId);
        }
      }
      throw error;
    }
  }

  async _fetchAllWithToken(endpoint, teacherId, options = {}, isRetry = false) {
    const results = [];
    const isLocalMode = process.env.STARTUP_MODE === '3';
    let nextUrl = `${this.httpClient.canvasBaseUrl}/api/v1${endpoint}`;
    let pageCount = 0;
    const MAX_PAGES = 50;

    let resolvedToken;
    try {
      resolvedToken = isLocalMode
        ? await this._resolveLocalToken(teacherId)
        : await this.tokenManager.getValidToken(teacherId);
    } catch (tokenErr) {
      logger.error(`[CanvasLmsAdapter] Error obteniendo token para ${teacherId}: ${tokenErr.message}`);
      throw tokenErr;
    }

    while (nextUrl && pageCount < MAX_PAGES) {
      pageCount++;
      const relativePath = nextUrl.replace(`${this.httpClient.canvasBaseUrl}/api/v1`, '');
      
      try {
        const res = await this.httpClient.apiFetch(relativePath, resolvedToken, { ...options, method: 'GET', returnFullResponse: true });
        
        const data = await res.json();
        results.push(...(Array.isArray(data) ? data : [data]));
        nextUrl = this.httpClient.getNextLink(res.headers.get('link'));
      } catch (error) {
        if (error instanceof AppError && error.statusCode === 401) {
          if (!isRetry && !isLocalMode) {
            logger.warn(`[CanvasLmsAdapter] 401 recibido en _fetchAllWithToken para ${teacherId}. Intentando forzar refresh...`);
            try {
              await this.tokenManager.forceRefresh(teacherId);
              return await this._fetchAllWithToken(endpoint, teacherId, options, true);
            } catch (refreshError) {
              await this.tokenManager.invalidateToken(teacherId);
              throw refreshError;
            }
          } else if (!isLocalMode) {
            await this.tokenManager.invalidateToken(teacherId);
          }
        }
        throw error;
      }
    }

    return results;
  }

  async getCourses(teacherId) {
    if (this.useLocalData) {
      const numericId = await this._mapLocalId(teacherId, 'getCourses');
      return (await this._getLocalService()).getCourses(numericId);
    }
    const localOpts = process.env.STARTUP_MODE === '3' ? { maxRetries: 2, timeoutMs: 20000 } : {};
    return this._fetchAllWithToken(`/users/self/courses?enrollment_type=teacher&per_page=50`, teacherId, localOpts);
  }

  async getStudents(courseId, teacherId) {
    if (this.useLocalData) {
      logger.info(`[CanvasLmsAdapter] getStudents - Usando localData para curso ${courseId}`);
      return (await this._getLocalService()).getStudents(courseId);
    }
    const localOpts = process.env.STARTUP_MODE === '3' ? { maxRetries: 2, timeoutMs: 20000 } : {};
    return this._fetchAllWithToken(`/courses/${courseId}/users?enrollment_type[]=student&per_page=50`, teacherId, localOpts);
  }

  async getAssignments(courseId, teacherId) {
    if (this.useLocalData) {
      logger.info(`[CanvasLmsAdapter] getAssignments - Usando localData para curso ${courseId}`);
      return (await this._getLocalService()).getAssignments(courseId);
    }
    const localOpts = process.env.STARTUP_MODE === '3' ? { maxRetries: 2, timeoutMs: 20000 } : {};
    return this._fetchAllWithToken(`/courses/${courseId}/assignments?per_page=50`, teacherId, localOpts);
  }
  
  async getAssignment(courseId, assignmentId, teacherId) {
    if (this.useLocalData) {
      logger.info(`[CanvasLmsAdapter] getAssignment - Usando localData para curso ${courseId}, asig ${assignmentId}`);
      return (await this._getLocalService()).getAssignment(courseId, assignmentId);
    }
    return this._fetchWithToken(`/courses/${courseId}/assignments/${assignmentId}`, teacherId);
  }

  async getRubric(courseId, assignmentId, teacherId) {
    if (this.useLocalData) {
      logger.info(`[CanvasLmsAdapter] getRubric - Usando localData para asig ${assignmentId}`);
      return (await this._getLocalService()).getRubric(courseId, assignmentId);
    }
    const assignment = await this._fetchWithToken(`/courses/${courseId}/assignments/${assignmentId}`, teacherId);
    return assignment.rubric || [];
  }
  
  async getQuizQuestions(courseId, assignmentId, teacherId) {
    if (this.useLocalData) {
      logger.info(`[CanvasLmsAdapter] getQuizQuestions - Usando localData para asig ${assignmentId}`);
      return (await this._getLocalService()).getQuizQuestions(courseId, assignmentId);
    }
    const quizzes = await this._fetchAllWithToken(`/courses/${courseId}/quizzes`, teacherId);
    const quiz = quizzes.find(q => q.assignment_id == assignmentId);
    if (!quiz) return [];
    return this._fetchAllWithToken(`/courses/${courseId}/quizzes/${quiz.id}/questions`, teacherId);
  }
  
  async getSubmission(courseId, assignmentId, studentId, teacherId) {
    if (this.useLocalData) {
      logger.info(`[CanvasLmsAdapter] getSubmission - Usando localData para asig ${assignmentId}, est ${studentId}`);
      return (await this._getLocalService()).getSubmission(courseId, assignmentId, studentId);
    }
    return this._fetchWithToken(`/courses/${courseId}/assignments/${assignmentId}/submissions/${studentId}`, teacherId);
  }

  async getStudentGrades(courseId, studentId, teacherId) {
    if (this.useLocalData) {
      logger.info(`[CanvasLmsAdapter] getStudentGrades - Usando localData para curso ${courseId}, est ${studentId}`);
      return (await this._getLocalService()).getStudentGrades(courseId, studentId);
    }
    return this._fetchWithToken(`/courses/${courseId}/users/${studentId}/enrollments`, teacherId);
  }

  async postComment(courseId, assignmentId, studentId, teacherId, comment) {
    if (this.useLocalData) {
      const numericId = await this._mapLocalId(teacherId, 'postComment');
      return (await this._getLocalService()).postComment(courseId, assignmentId, studentId, numericId, comment);
    }
    return this._fetchWithToken(`/courses/${courseId}/assignments/${assignmentId}/submissions/${studentId}`, teacherId, {
      method: 'PUT',
      body: JSON.stringify({ comment: { text_comment: comment } })
    });
  }

  async updateGrade(courseId, assignmentId, studentId, teacherId, grade) {
    if (this.useLocalData) {
      const numericId = await this._mapLocalId(teacherId, 'updateGrade');
      return (await this._getLocalService()).updateGrade(courseId, assignmentId, studentId, numericId, grade);
    }
    return this._fetchWithToken(`/courses/${courseId}/assignments/${assignmentId}/submissions/${studentId}`, teacherId, {
      method: 'PUT',
      body: JSON.stringify({ submission: { posted_grade: grade } })
    });
  }

  async pushRubricAssessment(courseId, assignmentId, studentId, teacherId, rubricAssessment) {
    if (this.useLocalData) {
      const numericId = await this._mapLocalId(teacherId, 'pushRubricAssessment');
      return (await this._getLocalService()).pushRubricAssessment(courseId, assignmentId, studentId, numericId, rubricAssessment);
    }
    logger.info(`[CanvasLmsAdapter] Empujando rúbrica para estudiante ${studentId} en tarea ${assignmentId}`);
    return this._fetchWithToken(`/courses/${courseId}/assignments/${assignmentId}/submissions/${studentId}`, teacherId, {
      method: 'PUT',
      body: JSON.stringify({ rubric_assessment: rubricAssessment })
    });
  }

  async pushInAppMessage(courseId, studentId, teacherId, subject, bodyText) {
    if (this.useLocalData) {
      const numericId = await this._mapLocalId(teacherId, 'pushInAppMessage');
      return (await this._getLocalService()).pushInAppMessage(courseId, studentId, numericId, subject, bodyText);
    }
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
