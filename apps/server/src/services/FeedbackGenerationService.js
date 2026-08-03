import PromptManager from './PromptManager.js';
import GradeConverter from './calificaciones/GradeConverter.js';
import { DomainError } from '../utils/errors.js';
import CourseStatisticsService from './CourseStatisticsService.js';
import StudentNameResolver from './variables/StudentNameResolver.js';
import GradeResolver from './variables/GradeResolver.js';
import CourseAverageResolver from './variables/CourseAverageResolver.js';
import OtherCoursePerformanceResolver from './variables/OtherCoursePerformanceResolver.js';
import StudentEntryProfileResolver from './variables/StudentEntryProfileResolver.js';
import PreviousAcademicStatusResolver from './variables/PreviousAcademicStatusResolver.js';
import logger from '../utils/logger.js';

/**
 * FeedbackGenerationService - Responsabilidad única: orquestar generación de feedback.
 *
 * Separtado de FeedbackService para cumplir SRP. Usa dependency injection.
 */
export default class FeedbackGenerationService {
  constructor(iaProvider, canvasGateway, feedbackRepo, templateRepo, academicHistoryService, validadorAcademico, configRepo, iaConfigManager) {
    this.iaProvider = iaProvider;
    this.canvasGateway = canvasGateway;
    this.feedbackRepo = feedbackRepo;
    this.templateRepo = templateRepo;
    this.academicHistoryService = academicHistoryService;
    this.validadorAcademico = validadorAcademico;
    this.configRepo = configRepo;
    this.iaConfigManager = iaConfigManager;
    this.courseStatisticsService = new CourseStatisticsService(canvasGateway);
    
    // Instanciar Resolvers
    this.resolvers = [
      new StudentNameResolver(),
      new GradeResolver(),
      new CourseAverageResolver(this.canvasGateway, this.courseStatisticsService),
      new OtherCoursePerformanceResolver(),
      new StudentEntryProfileResolver(),
      new PreviousAcademicStatusResolver()
    ];
  }

  async generateFeedback(courseId, assignmentId, studentId, templateId, currentGrade, teacherId, metadata = {}) {
    try {
      logger.debug(`[DEBUG] generateFeedback started for student ${studentId}. isRegenerate = ${metadata.isRegenerate}`);
      // 1. Reglas de Negocio para Generación Masiva e Individual
      const existingFeedbacks = await this.feedbackRepo.findByStudent(studentId, courseId);
      
      // Regla A: Jamás regenerar si ya está enviado o aprobado
      const sentOrApproved = existingFeedbacks.find(fb => fb.tarea_id == assignmentId && (fb.estado === 'ENVIADO' || fb.estado === 'APROBADO'));
      if (sentOrApproved) {
        logger.debug(`[DEBUG] student ${studentId} skipped (sentOrApproved)`);
        return { exito: false, omitido: true, data: null, mensaje: 'Feedback ya enviado o aprobado' };
      }

      // Regla B: Si ya tiene borrador, solo regeneramos si la intención explícita era regenerar
      const pending = existingFeedbacks.find(fb => fb.tarea_id == assignmentId && (fb.estado === 'PENDIENTE' || fb.estado === 'EDITADO' || !fb.estado));
      if (pending && !metadata.isRegenerate) {
        logger.debug(`[DEBUG] student ${studentId} skipped (pending && !isRegenerate)`);
        return { exito: false, omitido: true, data: null, mensaje: 'El estudiante ya tiene un borrador y la acción no es forzar regeneración' };
      }

      // Regla C: Si la intención es explícitamente regenerar, saltar a los que no tienen feedback previo
      if (!pending && metadata.isRegenerate) {
        logger.debug(`[DEBUG] student ${studentId} skipped (!pending && isRegenerate)`);
        return { exito: false, omitido: true, data: null, mensaje: 'Modo regenerar activo, pero el estudiante no tiene feedback previo' };
      }
      
      logger.debug(`[DEBUG] student ${studentId} proceeding to fetchCanvasData`);

      const canvasData = await this._fetchCanvasData(courseId, assignmentId, studentId, teacherId);
      const { assignment, assignmentName, student, questions, rubric } = canvasData;

      const finalCourseName = metadata.courseName || `Curso ${courseId}`;
      const finalAssignmentName = metadata.assignmentName || assignmentName || assignment?.name || `Tarea ${assignmentId}`;
      const finalStudentName = metadata.studentName || student?.name || 'Estudiante';

      let chileGrade, approved, canvasScore;
      try {
        const gradeResult = this._convertGrade(currentGrade, canvasData.submission);
        chileGrade = gradeResult.chileGrade;
        approved = gradeResult.approved;
        canvasScore = gradeResult.canvasScore;
      } catch (err) {
        if (err.statusCode === 422) {
          logger.debug(`Este estudiante no ha entregado (Estudiante: ${studentId})`);
          return { exito: false, omitido: true, data: null, mensaje: 'Este estudiante no ha entregado', razon: err.errorCode || 'INSUFFICIENT_DATA' };
        }
        throw err;
      }

      const profile = await this._buildProfile(courseId, studentId, teacherId);

      const { context } = this._buildContext(
        courseId,
        studentId,
        assignmentId,
        finalAssignmentName,
        teacherId,
        currentGrade,
        canvasData.submission,
        questions,
        rubric,
        profile,
        chileGrade,
        canvasScore,
        finalStudentName
      );

      const template = await this.templateRepo.getById(templateId);
      if (!template) throw new DomainError('Plantilla no encontrada', 404);

      const activeVariablesText = await this._getActiveVariablesText(courseId);
      context.instructionIA = context.instructionIA + activeVariablesText;

      // Inyección modular de variables usando el Patrón Strategy
      const prompt = await PromptManager.buildPrompt(template.contenido, context, this.resolvers);

      let aiConfig = {};
      if (this.iaConfigManager) {
        try {
          aiConfig = await this.iaConfigManager.getActiveConfig('gemini');
        } catch (e) {
          // Si no hay configuración activa, se usará el fallback local o el key base del provider
        }
      }

      let feedbackText;
      try {
        feedbackText = await this.iaProvider.generateFeedback(prompt, {
          apiKey: aiConfig.apiKey,
          model: aiConfig.model || 'gemini-3.5-flash',
          maxOutputTokens: aiConfig.maxTokens,
          systemInstruction: context.instructionIA
        });
      } catch (aiErr) {
        logger.error('[IA_ERROR] Fallo al generar con IA', { error: aiErr.message });
        throw new DomainError(`Error de IA: ${aiErr.message}`, 502, 'AI_GENERATION_FAILED');
      }

      let saved;
      if (pending) {
        saved = await this.feedbackRepo.updateGeneratedFeedback(pending.id, {
          contenidoGenerado: feedbackText,
          promptUsado: prompt,
          notaCanvas: canvasScore,
          notaChile: chileGrade,
          aprobado: approved
        });
        // NOTA: Si queremos actualizar los nombres también en el update, habría que pasarlos,
        // pero por lo general se guardan al crear. Aquí lo mantenemos simple.
      } else {
        saved = await this.feedbackRepo.save({
          cursoId: courseId,
          tareaId: assignmentId,
          estudianteId: studentId,
          profesorId: teacherId,
          nombreCurso: finalCourseName,
          nombreTarea: finalAssignmentName,
          nombreEstudiante: finalStudentName,
          plantillaId: templateId,
          contenidoGenerado: feedbackText,
          promptUsado: prompt,
          notaCanvas: canvasScore,
          notaChile: chileGrade,
          aprobado: approved
        });
      }

      return {
        exito: true,
        data: {
          id: saved.id,
          content: saved.contenido_generado || saved.contenido || saved.contenidoGenerado || feedbackText,
          promptUsed: prompt,
          canvasScore,
          chileGrade,
          approved,
          studentName: finalStudentName,
          assignmentName: finalAssignmentName,
          profile: { level: profile.level, trend: profile.trend, average: profile.average }
        }
      };
    } catch (error) {
      logger.error('[FeedbackGenerationService] Error generando feedback', { error: error.message, stack: error.stack, studentId, assignmentId });
      throw error;
    }
  }

  async _fetchCanvasData(courseId, assignmentId, studentId, teacherId) {
    const [submission, questions, rubric, students] = await Promise.all([
      this.canvasGateway.getSubmission(courseId, assignmentId, studentId, teacherId),
      this.canvasGateway.getQuizQuestions(courseId, assignmentId, teacherId),
      this.canvasGateway.getRubric(courseId, assignmentId, teacherId),
      this.canvasGateway.getStudents(courseId, teacherId)
    ]);

    const student = students.find(s => s.id === studentId) || { name: 'Estudiante' };
    const assignment = (this.canvasGateway.getAssignment && (await this.canvasGateway.getAssignment(courseId, assignmentId, teacherId)))
      || (await this.canvasGateway.getAssignments(courseId, teacherId)).find(a => a.id === assignmentId)
      || { name: `Tarea ${assignmentId}` };

    return { submission, questions, rubric, students, student, assignment };
  }

  _convertGrade(currentGrade, submission) {
    const pointsPossibleRaw = submission?.points_possible;
    const pointsPossible = typeof pointsPossibleRaw === 'number' && Number.isFinite(pointsPossibleRaw)
      ? pointsPossibleRaw
      : 100;

    if (pointsPossible <= 0) {
      throw new DomainError('points_possible debe ser mayor a 0', 422, 'INSUFFICIENT_DATA');
    }

    // Plan A: Hay nota explícita del profesor (currentGrade)
    if (currentGrade !== undefined && currentGrade !== null && currentGrade !== '') {
      const parsedGrade = typeof currentGrade === 'number' ? currentGrade : parseFloat(currentGrade);
      if (!Number.isFinite(parsedGrade) || parsedGrade < 1.0 || parsedGrade > 7.0) {
        throw new DomainError('Nota chilena fuera de rango (1.0–7.0)', 422, 'INSUFFICIENT_DATA');
      }
      const rawCanvasScore = parsedGrade >= 4.0 
        ? 60 + ((parsedGrade - 4.0) / 3.0) * 40
        : ((parsedGrade - 1.0) / 2.9) * 60;
      
      const { chileGrade, approved } = GradeConverter.toChileGrade(rawCanvasScore, pointsPossible);
      return { chileGrade, approved, canvasScore: Math.round(rawCanvasScore) };
    }
    
    // Plan B: No hay nota explícita, usamos el puntaje de Canvas (score, entered_score o unposted_score)
    const rawScore = submission?.score ?? submission?.entered_score ?? submission?.unposted_score;
    if (submission && rawScore !== undefined && rawScore !== null) {
      const rawCanvasScore = typeof rawScore === 'number' ? rawScore : parseFloat(rawScore);
      if (!Number.isFinite(rawCanvasScore) || rawCanvasScore < 0 || rawCanvasScore > pointsPossible) {
        throw new DomainError(`Calificación Canvas fuera de rango (0–${pointsPossible})`, 422, 'INSUFFICIENT_DATA');
      }
      const { chileGrade, approved } = GradeConverter.toChileGrade(rawCanvasScore, pointsPossible);
      return { chileGrade, approved, canvasScore: Math.round(rawCanvasScore) };
    }

    // Plan C: Ni nota explícita ni puntaje
    throw new DomainError('No se puede generar feedback porque la entrega no tiene puntaje ni calificación asignada', 422, 'INSUFFICIENT_DATA');
  }

  async _buildProfile(courseId, studentId, teacherId) {
    const profileData = await this.academicHistoryService.getStudentAcademicProfile(courseId, studentId, teacherId);
    return this.validadorAcademico.generateStudentProfile(profileData.history);
  }

  _buildContext(courseId, studentId, assignmentId, assignmentName, teacherId, currentGrade, submission, questions, rubric, profile, chileGrade, canvasScore, finalStudentName) {
    const questionSet = submission.questions || questions;

    const correctCount = submission.correct_count ?? questionSet.filter(q => q.is_correct).length;
    const incorrectCount = submission.incorrect_count ?? (questionSet.length - correctCount);
    const accuracyPct = submission.accuracy_percent ??
      (questionSet.length > 0 ? Math.round((correctCount / questionSet.length) * 100) : null);

      let tendenciaPrompt = `El estudiante tiene un nivel ${profile.level}. `;
      if (profile.trend === 'Mejora') tendenciaPrompt += "Menciona explícitamente al estudiante: Has tenido mejora en el semestre. ";
      else if (profile.trend === 'Retroceso') tendenciaPrompt += "Menciona explícitamente al estudiante: Has tenido un pequeño retroceso. ";
      else tendenciaPrompt += "Menciona explícitamente al estudiante: Has mantenido un rendimiento constante. ";

      const context = {
        courseId,
        assignmentId,
        teacherToken: teacherId, // El token o ID de LTI que el servicio CanvasGateway pueda usar
        currentGrade, // Para el GradeResolver
        student: { id: studentId, name: finalStudentName },
        assignment: { id: assignmentId, name: assignmentName },
        submission: {
          body: submission.body,
          score: submission.score, // Conservamos el original para GradeResolver
          canvasScore,
          chileGrade,
          pointsPossible: submission.points_possible || 100,
          submittedAt: submission.submitted_at,
          correctCount,
          incorrectCount,
          accuracyPercent: accuracyPct,
          assignment: submission.assignment
        },
        rubric,
        profile,
        instructionIA: tendenciaPrompt +
          `Genera la respuesta estrictamente en el idioma que solicite la plantilla o el profesor, si no se especifica, usa español.`
      };

    return { context };
  }

  async _getActiveVariablesText(courseId) {
    if (!this.courseVariablesService) {
      const CourseVariablesService = (await import('./variables/CourseVariablesService.js')).default;
      this.courseVariablesService = new CourseVariablesService();
    }
    const courseVariables = await this.courseVariablesService.getCourseVariables(courseId);
    const activeVars = Object.values(courseVariables).filter(v => v.activa);
    
    let activeVariablesText = "";
    if (activeVars.length > 0) {
      activeVariablesText = "\\nAdicionalmente, ten en cuenta las siguientes variables de personalización solicitadas por el profesor:\\n";
      activeVars.forEach(v => {
        activeVariablesText += `- ${v.nombre} (Relevancia: ${v.ponderacion}%)\\n`;
      });
      activeVariablesText += "Debes dedicar proporcionalmente más espacio, profundidad y atención en tu respuesta a aquellas variables que tengan mayor ponderación.\\n";
    }
    return activeVariablesText;
  }
}