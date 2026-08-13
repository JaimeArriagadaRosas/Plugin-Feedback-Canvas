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
    return this.feedbackRepo.updateStatusAndContent(id, FeedbackStateMachine.STATES.EDITED, nuevoContenido);
  }

  async rateByTeacher(feedbackId, rating) {
    const existing = await this.feedbackRepo.getById(feedbackId);
    if (!existing) throw new AppError('Feedback no encontrado', 404);
    if (![FeedbackStateMachine.STATES.APPROVED, FeedbackStateMachine.STATES.SENT].includes(existing.estado)) {
      throw new AppError('Solo se pueden valorar feedbacks ya aprobados.', 400);
    }
    await this.feedbackRepo.updateProfesorRating(feedbackId, rating);
    return { feedbackId, rating };
  }

  async rateByStudent(feedbackId, rating, esUtil, ltiContext = null) {
    if (ltiContext?.studentId != null) await this._assertStudentOwnership(feedbackId, ltiContext.studentId);
    await this.feedbackRepo.updateEstudianteRating(feedbackId, rating, esUtil);
  }

  async approveAndSend(command, ltiContext = null, providedTeacherId = null) {
    const context = await this._prepareApproval(command, ltiContext, providedTeacherId);
    await this._publishToCanvas(context);
    if (!context.feedbackId) return this._baseResult(context);

    await this._markAsSent(context.feedbackId, context.content, context.grade);
    return this._notifyAndRecord(context);
  }

  async submitManualFeedback({ courseId, assignmentId, studentId, teacherId, contenidoManual, grade, studentName }) {
    if (!contenidoManual) throw new AppError('El contenido manual es requerido', 400);
    if (!teacherId) throw new AppError('teacherId es requerido para feedback manual', 400);
    const nombreEstudiante = studentName || await this._resolveStudentName(courseId, studentId, teacherId);
    const feedback = await this.feedbackRepo.save({
      estudianteId: studentId,
      profesorId: teacherId,
      cursoId: courseId,
      tareaId: assignmentId,
      plantillaId: 1,
      nombreEstudiante,
      contenidoGenerado: contenidoManual,
      promptUsado: 'MODO MANUAL - SIN IA (RF62)',
      notaCanvas: grade ?? null,
      notaChile: null,
      aprobado: false
    });
    await this.feedbackRepo.updateStatusAndContent(feedback.id, FeedbackStateMachine.STATES.PENDING, contenidoManual);
    return feedback;
  }

  async _prepareApproval(command, ltiContext, providedTeacherId) {
    const context = {
      feedbackId: command.feedbackId,
      teacherId: providedTeacherId || ltiContext?.user || 'system',
      courseId: command.courseId,
      assignmentId: command.assignmentId,
      studentId: command.studentId,
      content: command.content,
      grade: command.grade,
      rubricData: command.rubricData,
      originalState: FeedbackStateMachine.STATES.PENDING
    };
    if (!context.feedbackId) return context;

    const existing = await this.feedbackRepo.getById(context.feedbackId);
    if (!existing) throw new AppError('Feedback no encontrado', 404);
    this._validateApproval(existing, context, ltiContext);
    this._hydrateApprovalContext(context, existing);

    const claimed = await this.feedbackRepo.claimForApproval(context.feedbackId, context.content);
    if (!claimed) throw new AppError('El feedback ya está siendo procesado o fue enviado previamente.', 409);
    if (command.rating !== undefined && command.rating !== null) {
      await this.feedbackRepo.updateProfesorRating(context.feedbackId, command.rating);
    }
    return context;
  }

  _validateApproval(existing, context, ltiContext) {
    FeedbackStateMachine.validateCanApprove(existing.estado);
    this._assertMatches(existing.estudiante_id, context.studentId, 'el estudiante indicado');
    this._assertMatches(existing.curso_id, context.courseId, 'el curso indicado');
    this._assertMatches(existing.estudiante_id, ltiContext?.studentId, 'el contexto LTI');
    if (existing.profesor_id && context.teacherId !== 'system' &&
      String(existing.profesor_id) !== String(context.teacherId)) {
      throw new AppError('Acceso denegado: el feedback pertenece a otro profesor.', 403);
    }
  }

  _assertMatches(actual, supplied, label) {
    if (supplied != null && String(actual) !== String(supplied)) {
      throw new AppError(`Acceso denegado: el feedback no pertenece a ${label}.`, 403);
    }
  }

  _hydrateApprovalContext(context, existing) {
    context.originalState = existing.estado || FeedbackStateMachine.STATES.PENDING;
    context.courseId = existing.curso_id;
    context.assignmentId = existing.tarea_id;
    context.studentId = existing.estudiante_id;
    context.content = context.content ?? existing.contenido_generado;
  }

  async _publishToCanvas(context) {
    try {
      if (context.rubricData) {
        await this.canvasGateway.pushRubricAssessment(
          context.courseId, context.assignmentId, context.studentId, context.teacherId, context.rubricData
        );
      } else {
        const content = RichTextProcessor.process(context.content);
        await this.canvasGateway.postComment(
          context.courseId, context.assignmentId, context.studentId, context.teacherId, content
        );
      }
      if (this._hasGrade(context.grade)) {
        await this.canvasGateway.updateGrade(
          context.courseId, context.assignmentId, context.studentId, context.teacherId, context.grade
        );
      }
    } catch (error) {
      await this._restoreFeedbackAfterCanvasFailure(context, error);
      throw error;
    }
  }

  async _restoreFeedbackAfterCanvasFailure(context, error) {
    logger.error('[FeedbackMutation] Error en Canvas al aprobar y enviar feedback', {
      error: error.message, feedbackId: context.feedbackId, studentId: context.studentId
    });
    if (!context.feedbackId) return;
    await this.feedbackRepo.updateStatusAndContent(context.feedbackId, context.originalState, context.content)
      .catch((restoreError) => logger.error('[FeedbackMutation] Error crítico: Fallo al revertir estado', {
        feedbackId: context.feedbackId, error: restoreError.message
      }));
  }

  async _notifyAndRecord(context) {
    const method = await this._getNotificationMethod(context.studentId);
    const delivery = await this._deliverNotifications(method, context);
    if (method === 'none') return this._baseResult(context);

    const usedMethod = this._resolveUsedMethod(method, delivery);
    const warnings = await this._recordNotification(context, usedMethod);
    return { ...this._baseResult(context), warnings: warnings.length ? warnings : undefined };
  }

  async _getNotificationMethod(studentId) {
    if (!this.preferencesService) return 'canvas_inapp';
    const preferences = await this.preferencesService.getStudentPreference(studentId);
    return preferences.metodo;
  }

  async _deliverNotifications(method, context) {
    const inApp = method === 'canvas_inapp' || method === 'both';
    const email = method === 'email' || method === 'both';
    return {
      inApp: inApp && context.teacherId ? await this._sendInApp(context) : false,
      email: email ? await this._sendEmail(context) : false
    };
  }

  async _sendInApp(context) {
    try {
      await this.canvasGateway.pushInAppMessage(
        context.courseId, context.studentId, context.teacherId,
        'Nuevo Feedback Disponible', 'Se ha publicado un nuevo feedback para tu entrega.'
      );
      return true;
    } catch (error) {
      logger.warn('[FeedbackMutation] Error al enviar mensaje in-app', { error: error.message });
      return false;
    }
  }

  async _sendEmail(context) {
    try {
      if (!this.emailService) throw new Error('Proveedor de correo no configurado');
      await this.emailService.sendNotification(context.studentId, context.courseId, 'Nuevo Feedback Disponible');
      return true;
    } catch (error) {
      logger.warn('[FeedbackMutation] Error al enviar correo', { error: error.message });
      return false;
    }
  }

  _resolveUsedMethod(method, delivery) {
    if (method === 'both') return delivery.inApp && delivery.email ? 'both' :
      delivery.inApp ? 'canvas_inapp' : delivery.email ? 'email' : 'error_both';
    if (method === 'canvas_inapp') return delivery.inApp ? 'canvas_inapp' : 'error_canvas_inapp';
    return delivery.email ? 'email' : 'error_email';
  }

  async _recordNotification(context, usedMethod) {
    if (!usedMethod.startsWith('error_')) {
      await this.feedbackRepo.saveNotification(
        context.studentId, context.feedbackId,
        `Tienes un nuevo feedback aprobado en el curso ${context.courseId}`, usedMethod
      );
      return [];
    }
    if (this.systemNotificationService) {
      await this.systemNotificationService.saveNotification(
        context.teacherId, 'NOTIFICATION_FAILED',
        `Falló el envío de notificación al estudiante ${context.studentId} para la tarea ${context.assignmentId}`
      );
    }
    await this.feedbackRepo.saveNotification(
      context.studentId, context.feedbackId,
      `Tienes un nuevo feedback aprobado en el curso ${context.courseId}`, usedMethod
    );
    return ['NOTIFICATION_FAILED'];
  }

  async _markAsSent(feedbackId, content, grade) {
    const args = [feedbackId, FeedbackStateMachine.STATES.SENT, content];
    if (this._hasGrade(grade)) args.push(grade);
    await this.feedbackRepo.updateStatusAndContent(...args);
  }

  _hasGrade(grade) {
    return grade !== undefined && grade !== null && grade !== '';
  }

  _baseResult({ feedbackId, studentId }) {
    return { feedbackId, studentId };
  }

  async _assertStudentOwnership(feedbackId, studentId) {
    const existing = await this.feedbackRepo.getById(feedbackId);
    if (!existing) throw new AppError('Feedback no encontrado', 404);
    if (String(existing.estudiante_id) !== String(studentId)) {
      throw new AppError('Acceso denegado: no puedes calificar el feedback de otro estudiante.', 403);
    }
  }

  async _resolveStudentName(courseId, studentId, teacherId) {
    try {
      const students = await this.canvasGateway.getStudents(courseId, teacherId);
      return students.find((student) => String(student.id) === String(studentId))?.name || `Estudiante ${studentId}`;
    } catch (error) {
      logger.warn('[FeedbackMutation] No se pudo resolver el nombre del estudiante', {
        courseId, studentId, error: error.message
      });
      return `Estudiante ${studentId}`;
    }
  }
}
