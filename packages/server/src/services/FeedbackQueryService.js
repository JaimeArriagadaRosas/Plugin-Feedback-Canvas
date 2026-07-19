/**
 * FeedbackQueryService - Responsabilidad única: consultas y mapeo de DTOs.
 *
 * Separtado de FeedbackService para cumplir SRP.
 */
export default class FeedbackQueryService {
  constructor(feedbackRepo, canvasGateway, academicHistoryService, validadorAcademico) {
    this.feedbackRepo = feedbackRepo;
    this.canvasGateway = canvasGateway;
    this.academicHistoryService = academicHistoryService;
    this.validadorAcademico = validadorAcademico;
  }

  async rateByStudent(feedbackId, rating, ltiContext = null) {
    // BOLA prevention (OWASP API1:2023): un estudiante solo puede calificar su propio feedback.
    if (ltiContext?.studentId != null) {
      const existing = await this.feedbackRepo.getById(feedbackId);
      if (!existing) {
        const { AppError } = await import('../utils/errors.js');
        throw new AppError('Feedback no encontrado', 404);
      }
      if (String(existing.estudiante_id) !== String(ltiContext.studentId)) {
        const { AppError } = await import('../utils/errors.js');
        throw new AppError('Acceso denegado: no puedes calificar el feedback de otro estudiante.', 403);
      }
    }
    await this.feedbackRepo.updateEstudianteRating(feedbackId, rating);
  }

  async getStudentView(studentId, courseId) {
    const inferredCourseId = await this._resolveCourseId(courseId, studentId);
    const approved = await this._getApprovedFeedbacks(studentId, inferredCourseId);
    const assignments = await this._buildAssignmentsWithFeedback(inferredCourseId, approved);
    return assignments;
  }

  async getListAll(courseId = null) {
    const feedbacks = await this.feedbackRepo.listAll();
    const dtos = await Promise.all(feedbacks.map(fb => this._mapFeedbackToDTO(fb)));
    return dtos;
  }

  async getStats(courseId = null, assignmentId = null) {
    return this.feedbackRepo.getStats(courseId, assignmentId);
  }

  async findByStudent(studentId, courseId) {
    const feedbacks = await this.feedbackRepo.findByStudent(studentId, courseId);
    return feedbacks.map(fb => this._mapFeedbackToDTOSync(fb));
  }

  _mapFeedbackToDTOSync(fb) {
    return {
      id: fb.id,
      student: fb.nombre_estudiante || `Estudiante ${fb.estudiante_id}`,
      studentId: fb.estudiante_id,
      courseId: fb.curso_id,
      assignmentId: fb.tarea_id,
      templateId: fb.plantilla_id,
      grade: fb.nota_chile ? `${fb.nota_chile}/7.0` : 'Pendiente',
      profile: 'PROMEDIO',
      trend: 'Estable',
      status: fb.estado || 'PENDIENTE',
      feedback: fb.contenido_generado
    };
  }

  async _resolveCourseId(courseId, studentId) {
    if (!courseId) {
      // DESIGN-05: findByStudent requiere courseId. Si no viene en la request,
      // usamos la variable de entorno del canal configurado. Si tampoco existe,
      // retornamos null para que la capa superior maneje el error correctamente.
      const envCourseId = process.env.CANVAS_COURSE_ID || process.env.VITE_CANVAS_COURSE_ID;
      if (!envCourseId) {
        return null;
      }
      return envCourseId;
    }
    return courseId;
  }

  async _getApprovedFeedbacks(studentId, courseId) {
    const history = await this.feedbackRepo.findByStudent(studentId, courseId);
    return history.filter(fb => fb.estado === 'APROBADO' || fb.estado === 'ENVIADO');
  }

  async _buildAssignmentsWithFeedback(courseId, approved) {
    let assignments = [];
    try {
      const raw = await this.canvasGateway.getAssignments(courseId);
      assignments = raw.map(a => ({
        id: a.id,
        name: a.name || `Tarea ${a.id}`,
        due: a.due_at || '',
        score: a.score || '-',
        total: a.points_possible ? String(a.points_possible) : '100',
        hasFeedback: false
      }));
    } catch (err) {
      if (err?.message) {
        const logger = (await import('../utils/logger.js')).default;
        logger.warn(`[FeedbackQuery] No se pudo obtener tareas del curso ${courseId}:`, { error: err.message });
      }
      assignments = [];
    }

    approved.forEach(fb => {
      const assignment = assignments.find(a => a.id == fb.tarea_id);
      if (assignment) {
        assignment.hasFeedback = true;
        assignment.feedback = fb;
      }
    });

    return assignments;
  }

  async _mapFeedbackToDTO(fb, preloadedStudents = null) {
    const [student, profile] = await Promise.all([
      this._fetchStudentName(fb.curso_id, fb.estudiante_id, preloadedStudents),
      this._fetchProfile(fb.curso_id, fb.estudiante_id)
    ]);

    return {
      id: fb.id,
      student: student.name,
      studentId: fb.estudiante_id,
      courseId: fb.curso_id,
      assignmentId: fb.tarea_id,
      templateId: fb.plantilla_id,
      grade: fb.nota_chile ? `${fb.nota_chile}/7.0` : 'Pendiente',
      profile: profile.level || 'PROMEDIO',
      trend: profile.trend || 'Estable',
      status: fb.estado || 'PENDIENTE',
      feedback: fb.contenido_generado
    };
  }

  async _fetchStudentName(courseId, studentId, preloadedStudents = null) {
    try {
      const students = preloadedStudents || await this.canvasGateway.getStudents(courseId);
      return students.find(s => String(s.id) === String(studentId)) || { name: `Estudiante ${studentId}` };
    } catch (err) {
      if (err?.message) {
        const logger = (await import('../utils/logger.js')).default;
        logger.warn(`[FeedbackQuery] No se pudo obtener nombre de estudiante ${studentId}:`, { error: err.message });
      }
      return { name: `Estudiante ${studentId}` };
    }
  }

  async _fetchProfile(courseId, studentId) {
    try {
      const history = await this.academicHistoryService.getStudentAcademicProfile(courseId, studentId);
      return this.validadorAcademico.generateStudentProfile(history);
    } catch (err) {
      if (err?.message) {
        const logger = (await import('../utils/logger.js')).default;
        logger.warn(`[FeedbackQuery] No se pudo obtener perfil académico del estudiante ${studentId}:`, { error: err.message });
      }
      return { level: 'PROMEDIO', trend: 'Estable', average: null };
    }
  }
}