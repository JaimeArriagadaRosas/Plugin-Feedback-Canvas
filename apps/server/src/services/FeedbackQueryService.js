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
    
    const approved = await this._getApprovedFeedbacks(studentId, inferredCourseId);
    
    // FIX: En lugar de intentar consultar las tareas a la API de Canvas usando
    // un token genérico ('system') que no existe y genera errores, construimos
    // la lista de tareas del estudiante basándonos en los feedbacks aprobados 
    // que ya tenemos almacenados en la base de datos (SOLID - SRP).
    const assignments = approved.map(fb => ({
      id: fb.tarea_id,
      name: fb.nombre_tarea || `Tarea ${fb.tarea_id}`,
      due: fb.fecha_generacion ? new Date(fb.fecha_generacion).toLocaleDateString() : '',
      score: fb.nota_canvas ?? '-',
      total: '100', // Valor por defecto
      hasFeedback: true,
      feedback: { ...fb, teacherName: 'Profesor del Curso' }
    }));

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
      const isMyCourse = coursesMap.has(String(fb.curso_id));

      // Filtramos feedbacks que no pertenecen a los cursos del profesor
      if (teacherId !== 'system' && !isExplicitCourse && !isOwnFeedback && !isMyCourse) {
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
        grade: fb.nota_chile ?? fb.nota_canvas ?? null,
        profile: 'PROMEDIO',
        trend: 'Estable',
        status: fb.estado || 'PENDIENTE',
        feedback: fb.contenido_generado,
        rating: fb.calificacion_profesor ?? null,
        nota_privada: fb.nota_privada ?? '',
        studentRating: fb.calificacion_estudiante ?? null,
        isUseful: fb.es_util !== null && fb.es_util !== undefined ? fb.es_util : null
      };
    }).filter(Boolean);
  }

  async getPendingSummary(courseId, teacherId) {
    const list = await this.getListAll(courseId, teacherId);
    const pendingList = list.filter(fb => fb.status === 'PENDIENTE' || fb.status === 'EDITADO');
    return {
      count: pendingList.length,
      students: pendingList.map(fb => fb.student)
    };
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
      grade: fb.nota_chile ?? null,
      profile: 'PROMEDIO',
      trend: 'Estable',
      status: fb.estado || 'PENDIENTE',
      feedback: fb.contenido_generado,
      rating: fb.calificacion_profesor ?? null,
      nota_privada: fb.nota_privada ?? '',
      studentRating: fb.calificacion_estudiante ?? null,
      isUseful: fb.es_util !== null && fb.es_util !== undefined ? fb.es_util : null
    };
  }

  async _resolveCourseId(courseId, studentId) {
    return CourseIdResolver.resolve(courseId, studentId);
  }

  async _getApprovedFeedbacks(studentId, courseId) {
    const history = await this.feedbackRepo.findByStudent(studentId, courseId);
    return history.filter(fb => fb.estado === 'APROBADO' || fb.estado === 'ENVIADO');
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
      grade: fb.nota_chile ?? null,
      profile: this._translateProfile(profile.level || 'AVERAGE'),
      trend: this._translateTrend(profile.trend || 'STABLE'),
      status: fb.estado || 'PENDIENTE',
      feedback: fb.contenido_generado,
      rating: fb.calificacion_profesor ?? null,
      nota_privada: fb.nota_privada ?? '',
      studentRating: fb.calificacion_estudiante ?? null,
      isUseful: fb.es_util !== null && fb.es_util !== undefined ? fb.es_util : null
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

  async _fetchTeacherName(courseId, targetTeacherId, systemTeacherId = 'system') {
    try {
      const teachers = await this.canvasGateway.getTeachers(courseId, systemTeacherId);
      const teacher = teachers.find(t => String(t.id) === String(targetTeacherId));
      return teacher ? teacher.name : 'Profesor del Curso';
    } catch (err) {
      if (err?.message) {
        const logger = (await import('../utils/logger.js')).default;
        logger.warn(`[FeedbackQuery] No se pudo obtener nombre de profesor ${targetTeacherId}:`, { error: err.message });
      }
      return 'Profesor del Curso';
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
    // eslint-disable-next-line security/detect-object-injection
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
    // eslint-disable-next-line security/detect-object-injection
    return map[trend] || 'Estable';
  }
}
