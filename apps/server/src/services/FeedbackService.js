import FeedbackGenerationService from './FeedbackGenerationService.js';
import FeedbackQueryService from './FeedbackQueryService.js';
import { AppError } from '../utils/errors.js';
import logger from '../utils/logger.js';

/**
 * FeedbackService - Facade de composición.
 *
 * Mantiene la interfaz pública original (inyectada en bootstrap.js) pero
 * delega en servicios especializados para cumplir SRP sin romper dependencias.
 */
export default class FeedbackService {
  constructor(iaProvider, canvasGateway, feedbackRepo, templateRepo, academicHistoryService, validadorAcademico, configRepo, iaConfigManager) {
    this.generation = new FeedbackGenerationService(
      iaProvider, canvasGateway, feedbackRepo, templateRepo,
      academicHistoryService, validadorAcademico, configRepo, iaConfigManager
    );
    this.query = new FeedbackQueryService(
      feedbackRepo, canvasGateway, academicHistoryService, validadorAcademico
    );
    this.academicHistoryService = academicHistoryService;
    this.feedbackRepo = feedbackRepo;
    this.canvasGateway = canvasGateway;
  }

  // Orquestación
  generateFeedback(...args) {
    return this.generation.generateFeedback(...args);
  }

  generateMassive(courseId, activeAssignments, students, teacherId, isRegenerate = false) {
    setTimeout(async () => {
      for (const assignment of activeAssignments) {
        for (const student of students) {
          try {
             await this.generateFeedback(courseId, assignment.id, student.id, assignment.templateId || 1, undefined, teacherId, { isRegenerate });
          } catch (e) {
             logger.error(`[FeedbackService] Error en generación masiva para estudiante ${student.id} en tarea ${assignment.id}: ${e.message}`);
          }
        }
      }
    }, 0);
  }

  // Consultas
  getStats(...args) {
    return this.query.getStats(...args);
  }

  getListAll(courseId, teacherId) {
    return this.query.getListAll(courseId, teacherId);
  }

  findByStudent(...args) {
    return this.query.findByStudent(...args);
  }

  editFeedback(id, nuevoContenido) {
    return this.feedbackRepo.updateStatusAndContent(id, 'EDITADO', nuevoContenido);
  }

  rateByStudent(feedbackId, rating, ltiContext = null) {
    return this.query.rateByStudent(feedbackId, rating, ltiContext);
  }

  getStudentView(studentId, courseId, teacherId) {
    return this.query.getStudentView(studentId, courseId, teacherId);
  }

  // Operaciones de envío (se quedan aquí por acoplamiento con Canvas)
  async approveAndSend({ feedbackId, courseId, assignmentId, studentId, content, rating, grade, rubricData }, ltiContext = null, providedTeacherId = null) {
    const teacherId = providedTeacherId || ltiContext?.user || 'system';
    // BOLA prevention (OWASP API1:2023): el feedback debe pertenecer al estudiante/curso
    // indicados y, si hay contexto autenticado de estudiante, coincidir con él.
    if (feedbackId) {
      const existing = await this.feedbackRepo.getById(feedbackId);
      if (!existing) {
        throw new AppError('Feedback no encontrado', 404);
      }
      if (existing.estado === 'APROBADO' || existing.estado === 'ENVIADO') {
        throw new AppError('Este feedback ya ha sido aprobado y enviado previamente.', 400);
      }
      if (studentId != null && String(existing.estudiante_id) !== String(studentId)) {
        throw new AppError('Acceso denegado: el feedback no pertenece al estudiante indicado.', 403);
      }
      if (courseId != null && String(existing.curso_id) !== String(courseId)) {
        throw new AppError('Acceso denegado: el feedback no pertenece al curso indicado.', 403);
      }
      if (ltiContext?.studentId != null && String(existing.estudiante_id) !== String(ltiContext.studentId)) {
        throw new AppError('Acceso denegado: no puedes aprobar el feedback de otro estudiante.', 403);
      }
      await this.feedbackRepo.updateStatusAndContent(feedbackId, 'APROBADO', content);
      if (rating) {
        await this.feedbackRepo.updateProfesorRating(feedbackId, rating);
      }
    }

    try {
      if (rubricData) {
        await this.canvasGateway.pushRubricAssessment(courseId, assignmentId, studentId, teacherId, rubricData);
      } else {
        await this.canvasGateway.postComment(courseId, assignmentId, studentId, teacherId, content);
      }

      if (grade) {
        await this.canvasGateway.updateGrade(courseId, assignmentId, studentId, teacherId, grade);
      }
    } catch (canvasError) {
      // Si falla Canvas, revertir el estado en BD para mantener consistencia.
      // El feedback vuelve a EDITADO para que el profesor pueda reintentar.
      logger.error('[FeedbackService] Error en Canvas al aprobar y enviar feedback', { error: canvasError.message, feedbackId, studentId });
      if (feedbackId) {
        await this.feedbackRepo.updateStatusAndContent(feedbackId, 'EDITADO', content).catch(e => {
          logger.error('[FeedbackService] Error Crítico: Fallo al revertir estado del feedback tras error en Canvas', { feedbackId, error: e.message });
        });
      }
      throw canvasError;
    }

    if (feedbackId) {
      await this.feedbackRepo.saveNotification(
        studentId,
        feedbackId,
        `Tienes un nuevo feedback aprobado en el curso ${courseId}`
      );
      
      // RF42: Mensaje In-App
      if (teacherId) {
        try {
          await this.canvasGateway.pushInAppMessage(courseId, studentId, teacherId, 'Nuevo Feedback Disponible', 'Se ha publicado un nuevo feedback para tu entrega.');
        } catch (msgErr) {
          logger.warn('[FeedbackService] Error al enviar mensaje in-app', { error: msgErr.message });
        }
      }
    }

    return { feedbackId, studentId };
  }

  async rateByTeacher(feedbackId, rating, teacherId) {
    const existing = await this.feedbackRepo.getById(feedbackId);
    if (!existing) {
      throw new AppError('Feedback no encontrado', 404);
    }
    if (existing.estado !== 'APROBADO' && existing.estado !== 'ENVIADO') {
      throw new AppError('Solo se pueden valorar feedbacks ya aprobados.', 400);
    }
    await this.feedbackRepo.updateProfesorRating(feedbackId, rating);
    return { feedbackId, rating };
  }

  // RF62: Feedback manual
  async submitManualFeedback({ courseId, assignmentId, studentId, teacherId, contenidoManual, grade }) {
    if (!contenidoManual) {
      throw new AppError('El contenido manual es requerido', 400);
    }

    const fbGuardado = await this.feedbackRepo.save({
      estudianteId: studentId,
      cursoId: courseId,
      tareaId: assignmentId,
      plantillaId: null,
      contenidoGenerado: contenidoManual,
      promptUsado: 'MODO MANUAL - SIN IA (RF62)',
      notaCanvas: grade || null,
      notaChile: null,
      aprobado: true
    });

    await this.feedbackRepo.updateStatusAndContent(fbGuardado.id, 'ENVIADO', contenidoManual);
    
    try {
      await this.canvasGateway.postComment(courseId, assignmentId, studentId, teacherId, contenidoManual);

      if (grade) {
        await this.canvasGateway.updateGrade(courseId, assignmentId, studentId, teacherId, grade);
      }
    } catch (canvasError) {
      logger.error('[FeedbackService] Error en Canvas al enviar feedback manual', { error: canvasError.message, studentId });
      await this.feedbackRepo.updateStatusAndContent(fbGuardado.id, 'PENDIENTE', contenidoManual).catch(e => {
        logger.error('[FeedbackService] Error Crítico: Fallo al revertir estado del feedback manual tras error en Canvas', { feedbackId: fbGuardado.id, error: e.message });
      });
      throw canvasError;
    }

    return fbGuardado;
  }
}