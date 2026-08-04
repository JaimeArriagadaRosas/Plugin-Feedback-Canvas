import { AppError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { FeedbackStateMachine } from '../domain/feedback/FeedbackStateMachine.js';
import { RichTextProcessor } from '../modules/formatting/RichTextProcessor.js';

export default class FeedbackMutationService {
  constructor(feedbackRepo, canvasGateway, preferencesService, emailService, systemNotificationService) {
    this.feedbackRepo = feedbackRepo;
    this.canvasGateway = canvasGateway;
    this.preferencesService = preferencesService;
    this.emailService = emailService;
    this.systemNotificationService = systemNotificationService;
  }

  async editFeedback(id, nuevoContenido) {
    // Validar transición (opcional, si quisieramos bloquear ediciones en enviados)
    return this.feedbackRepo.updateStatusAndContent(id, FeedbackStateMachine.STATES.EDITED, nuevoContenido);
  }

  async rateByTeacher(feedbackId, rating, teacherId) {
    const existing = await this.feedbackRepo.getById(feedbackId);
    if (!existing) {
      throw new AppError('Feedback no encontrado', 404);
    }
    if (existing.estado !== FeedbackStateMachine.STATES.APPROVED && existing.estado !== FeedbackStateMachine.STATES.SENT) {
      throw new AppError('Solo se pueden valorar feedbacks ya aprobados.', 400);
    }
    await this.feedbackRepo.updateProfesorRating(feedbackId, rating);
    return { feedbackId, rating };
  }

  async rateByStudent(feedbackId, rating, esUtil, ltiContext = null) {
    // BOLA prevention: un estudiante solo puede calificar su propio feedback.
    if (ltiContext?.studentId != null) {
      const existing = await this.feedbackRepo.getById(feedbackId);
      if (!existing) {
        throw new AppError('Feedback no encontrado', 404);
      }
      if (String(existing.estudiante_id) !== String(ltiContext.studentId)) {
        throw new AppError('Acceso denegado: no puedes calificar el feedback de otro estudiante.', 403);
      }
    }
    await this.feedbackRepo.updateEstudianteRating(feedbackId, rating, esUtil);
  }

  async approveAndSend({ feedbackId, courseId, assignmentId, studentId, content, rating, grade, rubricData }, ltiContext = null, providedTeacherId = null) {
    const teacherId = providedTeacherId || ltiContext?.user || 'system';
    
    if (feedbackId) {
      const existing = await this.feedbackRepo.getById(feedbackId);
      if (!existing) throw new AppError('Feedback no encontrado', 404);
      
      FeedbackStateMachine.validateCanApprove(existing.estado);

      if (studentId != null && String(existing.estudiante_id) !== String(studentId)) {
        throw new AppError('Acceso denegado: el feedback no pertenece al estudiante indicado.', 403);
      }
      if (courseId != null && String(existing.curso_id) !== String(courseId)) {
        throw new AppError('Acceso denegado: el feedback no pertenece al curso indicado.', 403);
      }
      if (ltiContext?.studentId != null && String(existing.estudiante_id) !== String(ltiContext.studentId)) {
        throw new AppError('Acceso denegado: no puedes aprobar el feedback de otro estudiante.', 403);
      }
      
      await this.feedbackRepo.updateStatusAndContent(feedbackId, FeedbackStateMachine.STATES.APPROVED, content);
      if (rating) {
        await this.feedbackRepo.updateProfesorRating(feedbackId, rating);
      }
    }

    try {
      if (rubricData) {
        await this.canvasGateway.pushRubricAssessment(courseId, assignmentId, studentId, teacherId, rubricData);
      } else {
        const formattedContent = RichTextProcessor.process(content);
        await this.canvasGateway.postComment(courseId, assignmentId, studentId, teacherId, formattedContent);
      }
      if (grade) {
        await this.canvasGateway.updateGrade(courseId, assignmentId, studentId, teacherId, grade);
      }
    } catch (canvasError) {
      logger.error('[FeedbackMutation] Error en Canvas al aprobar y enviar feedback', { error: canvasError.message, feedbackId, studentId });
      if (feedbackId) {
        await this.feedbackRepo.updateStatusAndContent(feedbackId, FeedbackStateMachine.STATES.EDITED, content).catch(e => {
          logger.error('[FeedbackMutation] Error Crítico: Fallo al revertir estado', { feedbackId, error: e.message });
        });
      }
      throw canvasError;
    }

    if (feedbackId) {
      // Obtener preferencia (RF43)
      let metodo = 'canvas_inapp';
      if (this.preferencesService) {
        const prefs = await this.preferencesService.getStudentPreference(studentId);
        metodo = prefs.metodo;
      }

      let notificationSuccess = false;

      // Enviar notificación (RF42)
      const sendInApp = metodo === 'canvas_inapp' || metodo === 'both';
      const sendEmail = metodo === 'email' || metodo === 'both';
      
      let inAppSuccess = false;
      let emailSuccess = false;

      if (sendInApp && teacherId) {
        try {
          await this.canvasGateway.pushInAppMessage(courseId, studentId, teacherId, 'Nuevo Feedback Disponible', 'Se ha publicado un nuevo feedback para tu entrega.');
          inAppSuccess = true;
        } catch (msgErr) {
          logger.warn('[FeedbackMutation] Error al enviar mensaje in-app', { error: msgErr.message });
        }
      }
      
      if (sendEmail) {
        try {
          if (this.emailService) {
            await this.emailService.sendNotification(studentId, courseId, 'Nuevo Feedback Disponible');
          } else {
            logger.info(`[Email] Simulando envío de correo al estudiante ${studentId}`);
          }
          emailSuccess = true;
        } catch (e) {
          logger.warn('[FeedbackMutation] Error al enviar correo', { error: e.message });
        }
      }

      // Registrar notificación (RF44)
      if (metodo !== 'none') {
        let metodoUsado = metodo;
        if (metodo === 'both') {
          metodoUsado = (inAppSuccess && emailSuccess) ? 'both' : (inAppSuccess ? 'canvas_inapp' : (emailSuccess ? 'email' : 'error_both'));
        } else if (metodo === 'canvas_inapp') {
          metodoUsado = inAppSuccess ? 'canvas_inapp' : 'error_canvas_inapp';
        } else if (metodo === 'email') {
          metodoUsado = emailSuccess ? 'email' : 'error_email';
        }
        
        let warnings = [];
        if (metodoUsado.startsWith('error_')) {
            warnings.push('NOTIFICATION_FAILED');
            if (this.systemNotificationService) {
                await this.systemNotificationService.saveNotification(
                    teacherId,
                    'NOTIFICATION_FAILED',
                    `Falló el envío de notificación al estudiante ${studentId} para la tarea ${assignmentId}`
                );
            }
        }
        
        await this.feedbackRepo.saveNotification(studentId, feedbackId, `Tienes un nuevo feedback aprobado en el curso ${courseId}`, metodoUsado);
        
        return { feedbackId, studentId, warnings: warnings.length > 0 ? warnings : undefined };
      }
    }
    return { feedbackId, studentId };
  }

  async submitManualFeedback({ courseId, assignmentId, studentId, teacherId, contenidoManual, grade, studentName }) {
    if (!contenidoManual) throw new AppError('El contenido manual es requerido', 400);
    if (!teacherId) throw new AppError('teacherId es requerido para feedback manual', 400);

    const fbGuardado = await this.feedbackRepo.save({
      estudianteId: studentId,
      profesorId: teacherId,
      cursoId: courseId,
      tareaId: assignmentId,
      plantillaId: 1,
      nombreEstudiante: studentName || null,
      contenidoGenerado: contenidoManual,
      promptUsado: 'MODO MANUAL - SIN IA (RF62)',
      notaCanvas: grade || null,
      notaChile: null,
      aprobado: false
    });

    await this.feedbackRepo.updateStatusAndContent(fbGuardado.id, FeedbackStateMachine.STATES.PENDING, contenidoManual);
    
    return fbGuardado;
  }
}
