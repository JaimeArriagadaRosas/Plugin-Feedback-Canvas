import CourseIdResolver from './CourseIdResolver.js';

/**
 * FeedbackQueryService - Single responsibility: queries and DTO mapping.
 *
 * Separated from FeedbackService to comply with SRP.
 */
export default class FeedbackQueryService {
  constructor(feedbackRepo, canvasGateway, academicHistoryService, validadorAcademico) {
    this.feedbackRepo = feedbackRepo;
    this.canvasGateway = canvasGateway;
    this.academicHistoryService = academicHistoryService;
    this.validadorAcademico = validadorAcademico;
  }

  // The rateByStudent method has been moved to FeedbackMutationService

  async getStudentView(studentId, courseId, teacherId) {
    const inferredCourseId = await this._resolveCourseId(courseId, studentId);
    
    const approved = await this._getApprovedFeedbacks(studentId, inferredCourseId);
    
    // FIX: Instead of trying to query assignments from Canvas API using
    // a generic token ('system') that does not exist and generates errors, we build
    // the student's assignment list based on the approved feedbacks 
    // that we already have stored in the database (SOLID - SRP).
    const assignments = approved.map(fb => ({
      id: fb.tarea_id,
      name: fb.nombre_tarea || `Assignment ${fb.tarea_id}`,
      due: fb.fecha_generacion ? new Date(fb.fecha_generacion).toLocaleDateString() : '',
      score: fb.nota_canvas ?? '-',
      total: '100', // Valor por defecto
      hasFeedback: true,
      feedback: { ...fb, teacherName: 'Course Teacher' }
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
        logger.warn(`[FeedbackQuery] Could not fetch courses for teacher ${teacherId}:`, { error: err.message });
      }
    }
    
    // We use denormalization (names cached in DB) and complement with 1 single call to Canvas for courses.
    return feedbacks.map(fb => {
      const isExplicitCourse = courseId && String(courseId) === String(fb.curso_id);
      const isOwnFeedback = String(fb.profesor_id) === String(teacherId);
      const isMyCourse = coursesMap.has(String(fb.curso_id));

      // We filter out feedbacks that do not belong to the teacher's courses
      if (teacherId !== 'system' && !isExplicitCourse && !isOwnFeedback && !isMyCourse) {
        return null;
      }

      const mappedCourseName = coursesMap.get(String(fb.curso_id)) || fb.nombre_curso || `Course ${fb.curso_id}`;

      return {
        id: fb.id,
        student: fb.nombre_estudiante || `Student ${fb.estudiante_id}`,
        studentId: fb.estudiante_id,
        courseId: fb.curso_id,
        courseName: mappedCourseName,
        assignmentId: fb.tarea_id,
        assignmentName: fb.nombre_tarea || `Assignment ${fb.tarea_id}`,
        templateId: fb.plantilla_id,
        grade: fb.nota_chile ?? fb.nota_canvas ?? null,
        profile: 'AVERAGE',
        trend: 'Stable',
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
      student: fb.nombre_estudiante || `Student ${fb.estudiante_id}`,
      studentId: fb.estudiante_id,
      courseId: fb.curso_id,
      assignmentId: fb.tarea_id,
      templateId: fb.plantilla_id,
      grade: fb.nota_chile ?? null,
      profile: 'AVERAGE',
      trend: 'Stable',
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
      return students.find(s => String(s.id) === String(studentId)) || { name: `Student ${studentId}` };
    } catch (err) {
      if (err?.message) {
        const logger = (await import('../utils/logger.js')).default;
        logger.warn(`[FeedbackQuery] Could not fetch student name ${studentId}:`, { error: err.message });
      }
      return { name: `Student ${studentId}` };
    }
  }

  async _fetchTeacherName(courseId, targetTeacherId, systemTeacherId = 'system') {
    try {
      const teachers = await this.canvasGateway.getTeachers(courseId, systemTeacherId);
      const teacher = teachers.find(t => String(t.id) === String(targetTeacherId));
      return teacher ? teacher.name : 'Course Teacher';
    } catch (err) {
      if (err?.message) {
        const logger = (await import('../utils/logger.js')).default;
        logger.warn(`[FeedbackQuery] Could not fetch teacher name ${targetTeacherId}:`, { error: err.message });
      }
      return 'Course Teacher';
    }
  }

  async _fetchProfile(courseId, studentId, teacherId = 'system') {
    try {
      const profileResult = await this.academicHistoryService.getStudentAcademicProfile(courseId, studentId, teacherId);
      return this.validadorAcademico.generateStudentProfile(profileResult.history);
    } catch (err) {
      if (err?.message) {
        const logger = (await import('../utils/logger.js')).default;
        logger.warn(`[FeedbackQuery] Could not fetch academic profile of student ${studentId}:`, { error: err.message });
      }
      return { level: 'AVERAGE', trend: 'STABLE', average: null };
    }
  }

  _translateProfile(level) {
    const map = {
      'OUTSTANDING': 'OUTSTANDING',
      'EXCELLENT': 'EXCELLENT',
      'AVERAGE': 'AVERAGE',
      'NEEDS_SUPPORT': 'NEEDS SUPPORT',
      'AT_RISK': 'AT RISK'
    };
    // eslint-disable-next-line security/detect-object-injection
    return map[level] || 'AVERAGE';
  }

  _translateTrend(trend) {
    const map = {
      'IMPROVING': 'Improving',
      'UP': 'Improving',
      'WORSENING': 'Worsening',
      'DOWN': 'Worsening',
      'STABLE': 'Stable'
    };
    // eslint-disable-next-line security/detect-object-injection
    return map[trend] || 'Stable';
  }
}
