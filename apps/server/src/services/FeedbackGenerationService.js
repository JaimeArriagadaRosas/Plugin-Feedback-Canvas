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
import PreviousGradesResolver from './variables/PreviousGradesResolver.js';
import FeedbackValidator from './feedback/FeedbackValidator.js';
import FeedbackPersistenceHandler from './feedback/FeedbackPersistenceHandler.js';
import logger from '../utils/logger.js';
import IAProviderFactory from './ia/factories/IAProviderFactory.js';

/**
 * Servicio para generar feedback interactuando con Canvas y LLMs.
 *
 * Separtado de FeedbackService para cumplir SRP. Usa dependency injection.
 */
export default class FeedbackGenerationService {
  constructor(canvasGateway, feedbackRepo, templateRepo, academicHistoryService, validadorAcademico, configRepo, iaConfigManager) {
    this.canvasGateway = canvasGateway;
    this.feedbackRepo = feedbackRepo;
    this.templateRepo = templateRepo;
    this.academicHistoryService = academicHistoryService;
    this.validadorAcademico = validadorAcademico;
    this.configRepo = configRepo;
    this.iaConfigManager = iaConfigManager;
    this.courseStatisticsService = new CourseStatisticsService(canvasGateway);
    this.persistenceHandler = new FeedbackPersistenceHandler(feedbackRepo);
    
    // Instanciar Resolvers
    this.resolvers = [
      new StudentNameResolver(),
      new GradeResolver(),
      new CourseAverageResolver(this.canvasGateway, this.courseStatisticsService),
      new OtherCoursePerformanceResolver(),
      new StudentEntryProfileResolver(),
      new PreviousAcademicStatusResolver(),
      new PreviousGradesResolver()
    ];
  }

  async generateFeedback(courseId, assignmentId, studentId, templateId, currentGrade, teacherId, metadata = {}) {
    try {
      logger.debug(`[DEBUG] generateFeedback started for student ${studentId}. isRegenerate = ${metadata.isRegenerate}`);
      
      const existingFeedbacks = await this.feedbackRepo.findByStudent(studentId, courseId);
      const validation = FeedbackValidator.validateGeneration(existingFeedbacks, assignmentId, studentId, metadata.isRegenerate);
      
      if (!validation.isValid) {
        return validation.skipData;
      }

      const pending = existingFeedbacks.find(fb => fb.tarea_id == assignmentId && (fb.estado === 'PENDIENTE' || fb.estado === 'EDITADO' || !fb.estado));

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

      const activeVariablesInfo = await this._getActiveVariablesInfo(courseId);
      const isTrayectoriaActiva = activeVariablesInfo.isTrayectoriaActiva;

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
        finalStudentName,
        isTrayectoriaActiva
      );

      const template = await this.templateRepo.getById(templateId);
      if (!template) throw new DomainError('Plantilla no encontrada', 404);

      context.instructionIA = context.instructionIA + activeVariablesInfo.text;

      if (activeVariablesInfo.activeVars && activeVariablesInfo.activeVars.length > 0) {
        let variablesDataText = "\\nDatos del estudiante correspondientes a las variables activas:\\n";
        let addedData = false;
        
        for (const activeVar of activeVariablesInfo.activeVars) {
           const expectedTag = `{{${activeVar.key}}}`;
           const resolver = this.resolvers.find(r => r.variableName === expectedTag);
           if (resolver) {
              const value = await resolver.resolve(context);
              if (value && value.trim() !== '') {
                 variablesDataText += `- ${activeVar.nombre}: ${value}\\n`;
                 addedData = true;
              }
           }
        }
        
        if (addedData) {
           context.instructionIA += variablesDataText;
        }
      }

      // Inyección modular de variables usando el Patrón Strategy
      const prompt = await PromptManager.buildPrompt(template.contenido, context, this.resolvers);

      let aiConfig = {};
      if (this.iaConfigManager) {
        try {
          aiConfig = await this.iaConfigManager.getGlobalActiveConfig();
        } catch (e) {
          throw new DomainError(`Error obteniendo configuración de IA: ${e.message}`, 500, 'AI_CONFIG_ERROR');
        }
      } else {
        throw new DomainError('IAConfigManager no está inyectado', 500, 'SERVER_ERROR');
      }

      const provider = IAProviderFactory.createProvider(aiConfig.service, aiConfig.apiKey, aiConfig.customEndpoint);

      let feedbackText;
      try {
        feedbackText = await provider.generateFeedback(prompt, {
          apiKey: aiConfig.apiKey,
          model: aiConfig.model || 'gemini-3.5-flash',
          maxOutputTokens: aiConfig.maxTokens,
          temperature: aiConfig.temperature,
          systemInstruction: context.instructionIA
        });
      } catch (aiErr) {
        throw new DomainError(`Error de IA: ${aiErr.message}`, 502, 'AI_GENERATION_FAILED');
      }

      const saved = await this.persistenceHandler.saveGeneratedFeedback({
        pending, courseId, assignmentId, studentId, teacherId, 
        finalCourseName, finalAssignmentName, finalStudentName, 
        templateId, feedbackText, prompt, canvasScore, chileGrade, approved
      });

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

  _buildContext(courseId, studentId, assignmentId, assignmentName, teacherId, currentGrade, submission, questions, rubric, profile, chileGrade, canvasScore, finalStudentName, isTrayectoriaActiva) {
    const questionSet = submission.questions || questions;

    const correctCount = submission.correct_count ?? questionSet.filter(q => q.is_correct).length;
    const incorrectCount = submission.incorrect_count ?? (questionSet.length - correctCount);
    const accuracyPct = submission.accuracy_percent ??
      (questionSet.length > 0 ? Math.round((correctCount / questionSet.length) * 100) : null);

      let tendenciaPrompt = '';
      if (isTrayectoriaActiva) {
        tendenciaPrompt = `El estudiante tiene un nivel ${profile.level}. `;
        if (profile.trend === 'Mejora') tendenciaPrompt += "Menciona explícitamente al estudiante: Has tenido mejora en el semestre. ";
        else if (profile.trend === 'Retroceso') tendenciaPrompt += "Menciona explícitamente al estudiante: Has tenido un pequeño retroceso. ";
        else tendenciaPrompt += "Menciona explícitamente al estudiante: Has mantenido un rendimiento constante. ";
      }

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
          `Genera la respuesta estrictamente en el idioma que solicite la plantilla o el profesor, si no se especifica, usa español. ` +
          `IMPORTANTE: Si la plantilla contiene formato de texto enriquecido como **negrita**, *cursiva*, <u>subrayado</u> o listas (- o 1.), debes preservar y replicar exactamente ese mismo formato en tu respuesta. Usa la misma sintaxis Markdown y etiquetas HTML que aparezcan en la plantilla.`
      };

    return { context };
  }

  async _getActiveVariablesInfo(courseId) {
    if (!this.courseVariablesService) {
      const CourseVariablesService = (await import('./variables/CourseVariablesService.js')).default;
      this.courseVariablesService = new CourseVariablesService();
    }
    const courseVariables = await this.courseVariablesService.getCourseVariables(courseId);
    const activeVars = Object.entries(courseVariables)
      .filter(([key, v]) => v.activa)
      .map(([key, v]) => ({ key, ...v }));
    
    let activeVariablesText = "";
    if (activeVars.length > 0) {
      activeVariablesText = "\\nAdicionalmente, ten en cuenta las siguientes variables de personalización solicitadas por el profesor:\\n";
      activeVars.forEach(v => {
        activeVariablesText += `- ${v.nombre} (Relevancia: ${v.ponderacion}%)\\n`;
      });
      activeVariablesText += "Debes dedicar proporcionalmente más espacio, profundidad y atención en tu respuesta a aquellas variables que tengan mayor ponderación.\\n";
    }
    return {
      text: activeVariablesText,
      activeVars: activeVars,
      isTrayectoriaActiva: !!courseVariables.trayectoria_academica?.activa
    };
  }
}