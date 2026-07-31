import { AppError } from '../utils/errors.js';
import CourseIdResolver from './CourseIdResolver.js';

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

  // El método rateByStudent ha sido movido a FeedbackMutationService

  async getStudentView(studentId, courseId, teacherId) {
    const inferredCourseId = await this._resolveCourseId(courseId, studentId);
    
    console.log('[DIAG-E2E] FeedbackQueryService.getStudentView', {
      studentId,
      courseId,
      inferredCourseId,
      teacherId
    });

    const approved = await this._getApprovedFeedbacks(studentId, inferredCourseId);
    
    // FIX H8: We use 'system' instead of the student's ID (passed as teacherId by mistake)
    // so the CanvasGateway uses the system token to fetch assignments, not the student's token.
    const assignments = await this._buildAssignmentsWithFeedback(inferredCourseId, approved, 'system');
    return assignments;
  }

  async getListAll(courseId = null, teacherId = 'system') {
    const feedbacks = await this.feedbackRepo.listAll(null, courseId);
    
    let coursesMap = new Map();
    try {
      if (teacherId !== 'system') {
        const courses = await this.canvasGateway.getCourses(teacherId);
        courses.forEach(c => coursesMap.set(String(c.id), c.name));
      }
    } catch (err) {
      if (err?.message) {
        const logger = (await import('../utils/logger.js')).default;
        logger.warn(`[FeedbackQuery] No se pudieron obtener los cursos del profesor ${teacherId}:`, { error: err.message });
      }
    }
    
    // Utilizamos desnormalización (nombres cacheados en DB) y complementamos con 1 sola llamada a Canvas para los cursos.
    return feedbacks.map(fb => {
      const isExplicitCourse = courseId && String(courseId) === String(fb.curso_id);
      const isOwnFeedback = String(fb.profesor_id) === String(teacherId);

      // Filtramos feedbacks que no pertenecen a los cursos del profesor
      if (teacherId !== 'system' && !isExplicitCourse && !isOwnFeedback) {
        return null;
      }

      const mappedCourseName = coursesMap.get(String(fb.curso_id)) || fb.nombre_curso || `Curso ${fb.curso_id}`;

      return {
        id: fb.id,
        student: fb.nombre_estudiante || `Estudiante ${fb.estudiante_id}`,
        studentId: fb.estudiante_id,
        courseId: fb.curso_id,
        courseName: mappedCourseName,
        assignmentId: fb.tarea_id,
        assignmentName: fb.nombre_tarea || `Tarea ${fb.tarea_id}`,
        templateId: fb.plantilla_id,
        grade: fb.nota_chile || null,
        profile: 'PROMEDIO',
        trend: 'Estable',
        status: fb.estado || 'PENDIENTE',
        feedback: fb.contenido_generado
      };
    }).filter(Boolean);
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
      grade: fb.nota_chile || null,
      profile: 'PROMEDIO',
      trend: 'Estable',
      status: fb.estado || 'PENDIENTE',
      feedback: fb.contenido_generado
    };
  }

  async _resolveCourseId(courseId, studentId) {
    return CourseIdResolver.resolve(courseId, studentId);
  }

  async _getApprovedFeedbacks(studentId, courseId) {
    console.log('[DIAG-E2E] FeedbackQueryService._getApprovedFeedbacks', {
      studentId,
      courseId,
      query: 'SELECT * FROM HFG WHERE estudiante_id = $1 AND curso_id = $2'
    });
    const history = await this.feedbackRepo.findByStudent(studentId, courseId);
    console.log('[DIAG-E2E] FeedbackRepository.findByStudent results count:', history.length);
    return history.filter(fb => fb.estado === 'APROBADO' || fb.estado === 'ENVIADO');
  }

  async _buildAssignmentsWithFeedback(courseId, approved, teacherId) {
    let assignments = [];
    try {
      console.log('[DIAG-E2E] FeedbackQueryService._buildAssignmentsWithFeedback Fetching Canvas API with teacherId:', teacherId);
      const raw = await this.canvasGateway.getAssignments(courseId, teacherId);
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

    if (assignments.length > 0) {
      approved.forEach(fb => {
        const assignment = assignments.find(a => a.id == fb.tarea_id);
        if (assignment) {
          assignment.hasFeedback = true;
          assignment.feedback = fb;
        }
      });
    } else {
      // Fallback: Si no pudimos obtener las tareas de Canvas, construimos la lista 
      // usando los feedbacks aprobados que tenemos en base de datos.
      assignments = approved.map(fb => ({
        id: fb.tarea_id,
        name: fb.nombre_tarea || `Tarea ${fb.tarea_id}`,
        due: fb.fecha_generacion ? new Date(fb.fecha_generacion).toLocaleDateString() : '',
        score: fb.nota_canvas ?? '-',
        total: '100', // Valor por defecto
        hasFeedback: true,
        feedback: fb
      }));
    }

    return assignments;
  }

  async _mapFeedbackToDTO(fb, preloadedStudents = null, teacherId = 'system') {
    const [student, profile] = await Promise.all([
      this._fetchStudentName(fb.curso_id, fb.estudiante_id, preloadedStudents, teacherId),
      this._fetchProfile(fb.curso_id, fb.estudiante_id, teacherId)
    ]);

    return {
      id: fb.id,
      student: student.name,
      studentId: fb.estudiante_id,
      courseId: fb.curso_id,
      assignmentId: fb.tarea_id,
      templateId: fb.plantilla_id,
      grade: fb.nota_chile || null,
      profile: this._translateProfile(profile.level || 'AVERAGE'),
      trend: this._translateTrend(profile.trend || 'STABLE'),
      status: fb.estado || 'PENDIENTE',
      feedback: fb.contenido_generado
    };
  }

  async _fetchStudentName(courseId, studentId, preloadedStudents = null, teacherId = 'system') {
    try {
      const students = preloadedStudents || await this.canvasGateway.getStudents(courseId, teacherId);
      return students.find(s => String(s.id) === String(studentId)) || { name: `Estudiante ${studentId}` };
    } catch (err) {
      if (err?.message) {
        const logger = (await import('../utils/logger.js')).default;
        logger.warn(`[FeedbackQuery] No se pudo obtener nombre de estudiante ${studentId}:`, { error: err.message });
      }
      return { name: `Estudiante ${studentId}` };
    }
  }

  async _fetchProfile(courseId, studentId, teacherId = 'system') {
    try {
      const profileResult = await this.academicHistoryService.getStudentAcademicProfile(courseId, studentId, teacherId);
      return this.validadorAcademico.generateStudentProfile(profileResult.history);
    } catch (err) {
      if (err?.message) {
        const logger = (await import('../utils/logger.js')).default;
        logger.warn(`[FeedbackQuery] No se pudo obtener perfil académico del estudiante ${studentId}:`, { error: err.message });
      }
      return { level: 'AVERAGE', trend: 'STABLE', average: null };
    }
  }

  _translateProfile(level) {
    const map = {
      'OUTSTANDING': 'SOBRESALIENTE',
      'EXCELLENT': 'DESTACADO',
      'AVERAGE': 'PROMEDIO',
      'NEEDS_SUPPORT': 'REQUIERE APOYO',
      'AT_RISK': 'EN RIESGO'
    };
    return map[level] || 'PROMEDIO';
  }

  _translateTrend(trend) {
    const map = {
      'IMPROVING': 'Mejorando',
      'UP': 'Mejorando',
      'WORSENING': 'Bajando',
      'DOWN': 'Bajando',
      'STABLE': 'Estable'
    };
    return map[trend] || 'Estable';
  }
}