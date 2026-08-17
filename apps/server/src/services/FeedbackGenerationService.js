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
 * Service to generate feedback interacting with Canvas and LLMs.
 *
 * Separated from FeedbackService to comply with SRP. Uses dependency injection.
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

      const finalCourseName = metadata.courseName || `Course ${courseId}`;
      const finalAssignmentName = metadata.assignmentName || assignmentName || assignment?.name || `Assignment ${assignmentId}`;
      const finalStudentName = metadata.studentName || student?.name || 'Student';

      let chileGrade, approved, canvasScore;
      try {
        const gradeResult = GradeConverter.processGrade(currentGrade, canvasData.submission);
        chileGrade = gradeResult.chileGrade;
        approved = gradeResult.approved;
        canvasScore = gradeResult.canvasScore;
      } catch (err) {
        if (err.statusCode === 422) {
          logger.debug(`This student has not submitted (Student: ${studentId})`);
          return { exito: false, omitido: true, data: null, mensaje: 'This student has not submitted', razon: err.errorCode || 'INSUFFICIENT_DATA' };
        }
        throw new DomainError(err.message, err.statusCode || 400, err.errorCode);
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
      if (!template || !template.contenido) throw new DomainError('Template not found or without content', 404);

      context.instructionIA = context.instructionIA + activeVariablesInfo.text;
      await this._appendActiveVariableData(context, activeVariablesInfo.activeVars);

      // Modular variable injection using Strategy Pattern
      const prompt = await PromptManager.buildPrompt(template.contenido, context, this.resolvers);

      let aiConfig = {};
      if (this.iaConfigManager) {
        try {
          aiConfig = await this.iaConfigManager.getGlobalActiveConfig();
        } catch (e) {
          throw new DomainError(`Error getting AI configuration: ${e.message}`, 500, 'AI_CONFIG_ERROR');
        }
      } else {
        throw new DomainError('IAConfigManager is not injected', 500, 'SERVER_ERROR');
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
        throw new DomainError(`AI Error: ${aiErr.message}`, 502, 'AI_GENERATION_FAILED');
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

  async _appendActiveVariableData(context, activeVariables = []) {
    const lines = [];
    for (const variable of activeVariables) {
      const resolver = this.resolvers.find((item) => item.variableName === `{{${variable.key}}}`);
      if (!resolver) continue;
      const value = await resolver.resolve(context);
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        lines.push(`- ${variable.nombre}: ${value}`);
      }
    }
    if (lines.length > 0) {
      context.instructionIA += `\\nStudent data corresponding to the active variables:\\n${lines.join('\\n')}\\n`;
    }
  }

  async _fetchCanvasData(courseId, assignmentId, studentId, teacherId) {
    const [submission, questions, rubric, students] = await Promise.all([
      this.canvasGateway.getSubmission(courseId, assignmentId, studentId, teacherId),
      this.canvasGateway.getQuizQuestions(courseId, assignmentId, teacherId),
      this.canvasGateway.getRubric(courseId, assignmentId, teacherId),
      this.canvasGateway.getStudents(courseId, teacherId)
    ]);

    const student = students.find(s => s.id === studentId) || { name: 'Student' };
    const assignment = (this.canvasGateway.getAssignment && (await this.canvasGateway.getAssignment(courseId, assignmentId, teacherId)))
      || (await this.canvasGateway.getAssignments(courseId, teacherId)).find(a => a.id === assignmentId)
      || { name: `Assignment ${assignmentId}` };

    return { submission, questions, rubric, students, student, assignment };
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
        tendenciaPrompt = `The student has a level of ${profile.level}. `;
        if (profile.trend === 'Mejora') tendenciaPrompt += "Explicitly mention to the student: You have improved during the semester. ";
        else if (profile.trend === 'Retroceso') tendenciaPrompt += "Explicitly mention to the student: You have had a slight setback. ";
        else tendenciaPrompt += "Explicitly mention to the student: You have maintained a constant performance. ";
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
          `Generate the response strictly in the language requested by the template or teacher, if not specified, use English. ` +
          `IMPORTANT: If the template contains rich text formatting such as **bold**, *italic*, <u>underline</u> or lists (- or 1.), you must preserve and exactly replicate that same formatting in your response. Use the same Markdown syntax and HTML tags that appear in the template.`
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
      activeVariablesText = "\\nAdditionally, consider the following customization variables requested by the teacher:\\n";
      activeVars.forEach(v => {
        activeVariablesText += `- ${v.nombre} (Relevance: ${v.ponderacion}%)\\n`;
      });
      activeVariablesText += "You must dedicate proportionally more space, depth, and attention in your response to those variables with greater weight.\\n";
    }
    return {
      text: activeVariablesText,
      activeVars: activeVars,
      isTrayectoriaActiva: !!courseVariables.academic_trajectory?.activa
    };
  }
}
