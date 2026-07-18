import logger from '../../utils/logger.js';
/**
 * Servicio de Integración con Canvas LMS (Full REST Implementation)
 * Implementa las llamadas necesarias para obtener contexto y persistir feedback.
 */
export default class CanvasService {
  constructor(accessToken, canvasBaseUrl, canvasHost) {
    this.accessToken = accessToken;
    this.canvasBaseUrl = canvasBaseUrl;
    // Canvas resuelve la cuenta (y por tanto valida el API token) a partir del
    // header Host. En Canvas Local el dominio configurado es 'canvas.local';
    // si no se envía, el token falla con 401. Se puede sobreescribir con
    // CANVAS_API_HOST.
    this.canvasHost = canvasHost || 'canvas.local';
  }

  async _fetch(endpoint, options = {}) {
    const timeoutMs = options.timeoutMs ?? 15000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const method = options.method || 'GET';

    try {
      const response = await fetch(`${this.canvasBaseUrl}/api/v1${endpoint}`, {
        ...options,
        method,
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/json',
          'Host': this.canvasHost,
          // Content-Type solo en métodos con body
          ...(method !== 'GET' && method !== 'HEAD' ? { 'Content-Type': 'application/json' } : {}),
          ...options.headers
        }
      });
      if (!response.ok) throw new Error(`Canvas API error [${response.status}]: ${response.statusText}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  _getNextLink(linkHeader) {
    if (!linkHeader) return null;
    const matches = linkHeader.match(/<([^>]+)>\s*;\s*rel="next"/i);
    return matches ? matches[1] : null;
  }

  async _fetchAll(endpoint, options = {}) {
    const results = [];
    let nextUrl = `${this.canvasBaseUrl}/api/v1${endpoint}`;
    let pageCount = 0;
    const MAX_PAGES = 50;

    while (nextUrl && pageCount < MAX_PAGES) {
      pageCount++;
      const timeoutMs = options.timeoutMs ?? 15000;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
      const response = await fetch(nextUrl, {
        ...options,
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/json',
          'Host': this.canvasHost,
          // _fetchAll es siempre GET (paginación)
          ...options.headers
        }
      });
        if (!response.ok) throw new Error(`Canvas API error [${response.status}]: ${response.statusText}`);
        const data = await response.json();
        if (Array.isArray(data)) {
          results.push(...data);
        } else {
          results.push(data);
        }
        nextUrl = this._getNextLink(response.headers.get('link'));
      } finally {
        clearTimeout(timer);
      }
    }

    return results;
  }

  // --- Cursos y Tareas ---
  async getCourses(userId) {
    if (!userId) {
      logger.warn('[CanvasService] getCourses llamado sin userId, utilizando endpoint genérico /courses');
      return this._fetchAll('/courses?enrollment_type=teacher&per_page=50');
    }

    // El contexto LTI expone `sub` (un UUID), pero la Canvas API espera un
    // id numérico o el pseudo-usuario "self". Si recibimos algo no numérico
    // (típico en LTI 1.3), consultamos los cursos del usuario autenticado
    // mediante /users/self/courses, que no depende del id.
    const isNumeric = /^\d+$/.test(String(userId));
    const endpoint = isNumeric
      ? `/users/${userId}/courses?enrollment_type=teacher&per_page=50`
      : '/users/self/courses?enrollment_type=teacher&per_page=50';

    logger.info(`[CanvasService] Obteniendo cursos para el usuario LTI: ${userId} (endpoint: ${endpoint})`);
    return this._fetchAll(endpoint);
  }

  async getStudents(courseId) {
    return this._fetchAll(`/courses/${courseId}/users?enrollment_type[]=student&per_page=50`);
  }

  async getCourse(courseId) {
    return this._fetch(`/courses/${courseId}`);
  }

  async getAssignments(courseId) {
    return this._fetchAll(`/courses/${courseId}/assignments?per_page=50`);
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

  // --- Quiz Questions (para exámenes de selección múltiple) ---
  async getQuizQuestions(courseId, assignmentId) {
    try {
      const quizzes = await this._fetchAll(`/courses/${courseId}/quizzes?per_page=50`);
      const targetQuiz = quizzes.find(q => String(q.assignment_id) === String(assignmentId)) || quizzes[0];
      if (!targetQuiz) return [];
      const questions = await this._fetchAll(`/courses/${courseId}/quizzes/${targetQuiz.id}/questions?per_page=100`);
      return questions.map((q, idx) => {
        const options = {};
        (q.answers || []).forEach((a, i) => {
          const letter = String.fromCharCode(65 + i);
          options[letter] = a.text || a.answer_text || '';
        });
        const correct = (q.answers || []).find(a => a.weight === 100 || a.correct);
        const correctLetter = correct ? String.fromCharCode(65 + (q.answers || []).indexOf(correct)) : null;
        return {
          id: q.id || `q${idx + 1}`,
          text: q.question_name || q.question_text || `Pregunta ${idx + 1}`,
          options,
          correct_answer: correctLetter,
          points: q.points_possible || 10
        };
      });
    } catch (e) {
      console.warn(`[CanvasService] getQuizQuestions: fallo al obtener preguntas del quiz`, { error: e.message });
      return [];
    }
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
