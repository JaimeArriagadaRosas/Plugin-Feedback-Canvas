import express from 'express';
import CourseController from '../controllers/CourseController.js';
import TemplateController from '../controllers/TemplateController.js';
import FeedbackController from '../controllers/FeedbackController.js';
import ConfigController from '../controllers/ConfigController.js';
import IAConfigController from '../controllers/IAConfigController.js';
import VariableConfigController from '../controllers/VariableConfigController.js';
import AdvancedFeedbackController from '../controllers/AdvancedFeedbackController.js';
import ManualFeedbackController from '../controllers/ManualFeedbackController.js';
import StatsController from '../controllers/StatsController.js';
import PermissionsController from '../controllers/PermissionsController.js';
import AuditLogController from '../controllers/AuditLogController.js';
import { authorizeRole } from '../authz/authorizeRole.js';
import { auditLogMiddleware } from '../middlewares/AuditLogMiddleware.js';
import { webhookLimiter, authLimiter, handleValidationErrors, validateId, validateCourseId, validateAssignmentId, validateStudentId, validateFeedbackDetailQuery } from '../middlewares/security.js';
import { schemas, validateBody, requireDeploymentId } from '../security/validation.js';
import ltiRouter from './lti/index.js';
import { nowIso } from '../utils/datetime.js';
import logger from '../utils/logger.js';

/**
 * Gestor de Rutas de la API — con Autorización por Roles y Logging completo.
 *
 * Las rutas LTI (/lti/login, /lti/callback, /lti/jwks) y /health se registran
 * ANTES del middleware de auditoría y son públicas: el check de rutas públicas
 * en AuthLTI13Handler (aplicado globalmente en /api) ya las excluye de auth.
 */
export default class GestorRutasAPI {
  constructor(dependencias) {
    this.router = express.Router();
    this.deps = dependencias;
    this.inicializarControladores();
    this.configurarRutasPublicas();
    this.configurarRutasProtegidas();
  }

  inicializarControladores() {
    this.courseCtrl    = new CourseController(this.deps.canvasService, this.deps.configRepo, this.deps.templateManager?.templateRepo);
    this.templateCtrl  = new TemplateController(this.deps.templateManager);
    this.feedbackCtrl  = new FeedbackController(this.deps.feedbackService, this.deps.canvasService);
    this.configCtrl    = new ConfigController(this.deps.iaConfigManager, this.deps.configRepo);
    this.iaConfigCtrl  = new IAConfigController(this.deps.llmConfigService);
    this.variableCtrl  = new VariableConfigController(this.deps.variableConfigManager);
    this.advancedFbCtrl = new AdvancedFeedbackController(this.deps.feedbackWorkflowService);
    this.manualFbCtrl   = new ManualFeedbackController(this.deps.feedbackService);
    this.statsCtrl      = new StatsController(this.deps.statsService);
    this.permissionsCtrl = new PermissionsController(this.deps.permissionsService);
    this.auditLogCtrl    = new AuditLogController();
    this.webhookCtrl    = this.deps.webhookController;
    logger.debug('Controladores de API inicializados');
  }

  /**
   * Rutas públicas — No requieren autenticación LTI.
   */
  configurarRutasPublicas() {
    this.router.get('/health', (req, res) => {
      logger.debug('Health check solicitado');
      res.json({
        status: 'API Operativa',
        timestamp: nowIso(),
        version: '1.0.0',
        uptime: Math.floor(process.uptime()) + 's'
      });
    });

    // Rechazar cualquier método que no sea GET en /health
    ['post', 'put', 'delete', 'patch'].forEach(method => {
      this.router[method]('/health', (req, res) => {
        res.status(405).json({
          exito: false,
          error: { codigo: 405, mensaje: 'Método no permitido' }
        });
      });
    });

    this.router.use('/lti', authLimiter, ltiRouter);
  }

  /**
   * Rutas protegidas — Requieren autenticación LTI (ya verificada por AuthLTI13Handler).
   * Se aplica el middleware de auditoría a todas estas rutas.
   */
  configurarRutasProtegidas() {
    // Auditoría en todas las rutas protegidas
    this.router.use(auditLogMiddleware);

    // ── Cursos y Tareas (Docentes y Administradores) ───────────────────────
    this.router.get(    '/courses',
      authorizeRole(['teacher']),
      handleValidationErrors,
      (req, res, next) => { logger.debug('GET /courses', { user: req.ltiContext?.user }); this.courseCtrl.getCourses(req, res, next); }
    );
    this.router.get(    '/courses/:courseId/assignments',
      authorizeRole(['teacher']),
      ...validateCourseId,
      handleValidationErrors,
      (req, res, next) => { logger.debug('GET /courses/:id/assignments', { courseId: req.params.courseId }); this.courseCtrl.getAssignments(req, res, next); }
    );
    this.router.get(    '/courses/:courseId/students',
      authorizeRole(['teacher']),
      ...validateCourseId,
      handleValidationErrors,
      (req, res, next) => this.courseCtrl.getStudents(req, res, next)
    );
    this.router.get(    '/courses/:courseId/assignments/:assignmentId/submissions/:studentId',
      authorizeRole(['teacher']),
      ...validateCourseId,
      ...validateAssignmentId,
      ...validateStudentId,
      handleValidationErrors,
      (req, res, next) => this.courseCtrl.getSubmission(req, res, next)
    );
    this.router.post(   '/courses/:courseId/assignments/:assignmentId/toggle',
      authorizeRole(['teacher']),
      ...validateCourseId,
      ...validateAssignmentId,
      handleValidationErrors,
      (req, res, next) => this.courseCtrl.togglePlugin(req, res, next)
    );

    // ── Plantillas (Docentes y Administradores) ────────────────────────────
    this.router.get(    '/templates',       authorizeRole(['teacher']), handleValidationErrors, (req, res, next) => this.templateCtrl.getAll(req, res, next));
    this.router.get(    '/templates/:id',   authorizeRole(['teacher']), ...validateId('id'), handleValidationErrors, (req, res, next) => this.templateCtrl.getOne(req, res, next));
    this.router.post(   '/templates',       authorizeRole(['teacher']), validateBody(schemas.templateCreate), (req, res, next) => this.templateCtrl.create(req, res, next));
    this.router.put(    '/templates/:id',   authorizeRole(['teacher']), ...validateId('id'), validateBody(schemas.templateUpdate), (req, res, next) => this.templateCtrl.update(req, res, next));
    this.router.delete( '/templates/:id',   authorizeRole(['teacher']), ...validateId('id'), handleValidationErrors, (req, res, next) => this.templateCtrl.delete(req, res, next));

    // ── Feedback (Docentes) ────────────────────────────────────────────────
    this.router.get(    '/feedback/list',     authorizeRole(['teacher']), (req, res, next) => this.feedbackCtrl.listAll(req, res, next));
    this.router.get(    '/feedback/pending',  authorizeRole(['teacher']), (req, res, next) => this.feedbackCtrl.listPending(req, res, next));
    this.router.get(    '/feedback/detail',   authorizeRole(['teacher']), ...validateFeedbackDetailQuery, handleValidationErrors, (req, res, next) => this.feedbackCtrl.getDetail(req, res, next));
    this.router.post(   '/feedback/generate', authorizeRole(['teacher']), validateBody(schemas.feedbackGenerate), (req, res, next) => this.feedbackCtrl.generate(req, res, next));
    this.router.put(    '/feedback/:id',      authorizeRole(['teacher']), ...validateId('id'), handleValidationErrors, validateBody(schemas.feedbackUpdate), (req, res, next) => this.feedbackCtrl.updateFeedback(req, res, next));
    this.router.post(   '/feedback/approve',  authorizeRole(['teacher']), validateBody(schemas.feedbackApprove), (req, res, next) => this.feedbackCtrl.approveAndSend(req, res, next));
    
    // ── Feedback Avanzado (RF27, RF28, RF67) ───────────────────────────────
    this.router.post(   '/feedback/bulk-approve', authorizeRole(['teacher']), (req, res, next) => this.advancedFbCtrl.bulkApprove(req, res, next));
    this.router.put(    '/feedback/:id/reject',   authorizeRole(['teacher']), ...validateId('id'), handleValidationErrors, (req, res, next) => this.advancedFbCtrl.rejectFeedback(req, res, next));
    this.router.put(    '/feedback/:id/memo',     authorizeRole(['teacher']), ...validateId('id'), handleValidationErrors, (req, res, next) => this.advancedFbCtrl.updatePrivateNote(req, res, next));

    // ── Respaldo Manual (RF62) ─────────────────────────────────────────────
    this.router.post(   '/feedback/manual',       authorizeRole(['teacher']), validateBody(schemas.feedbackManual), (req, res, next) => this.manualFbCtrl.submitManualFeedback(req, res, next));

    // ── Estadísticas y Reportes (RF46-RF49) ────────────────────────────────
    this.router.get(    '/stats/course/:courseId',
      authorizeRole(['teacher', 'admin']),
      ...validateCourseId,
      handleValidationErrors,
      (req, res, next) => this.statsCtrl.getCourseStats(req, res, next)
    );
    this.router.get(    '/stats/grades/:courseId',
      authorizeRole(['teacher', 'admin']),
      ...validateCourseId,
      handleValidationErrors,
      (req, res, next) => this.statsCtrl.getGradeDistribution(req, res, next)
    );
    this.router.get(    '/stats/ratings/:courseId',
      authorizeRole(['teacher', 'admin']),
      ...validateCourseId,
      handleValidationErrors,
      (req, res, next) => this.statsCtrl.getStudentRatings(req, res, next)
    );
    this.router.get(    '/stats/export/:courseId',
      authorizeRole(['teacher', 'admin']),
      ...validateCourseId,
      handleValidationErrors,
      (req, res, next) => this.statsCtrl.exportCsv(req, res, next)
    );
    this.router.get(    '/audit/logs',
      authorizeRole(['admin']),
      (req, res, next) => this.auditLogCtrl.getLogs(req, res, next)
    );

    // ── Webhooks (RF41) ────────────────────────────────────────────────────
    this.router.post('/webhooks/canvas', webhookLimiter, (req, res, next) => this.webhookCtrl.handleWebhook(req, res, next));

    // ── Feedback (Estudiantes) ─────────────────────────────────────────────
    this.router.get(    '/student/feedback/:studentId',
      authorizeRole(['student', 'teacher']),
      ...validateStudentId,
      requireDeploymentId,
      handleValidationErrors,
      (req, res, next) => this.feedbackCtrl.getStudentView(req, res, next)
    );
    this.router.post(   '/student/rate',
      authorizeRole(['student']),
      requireDeploymentId,
      validateBody(schemas.studentRate),
      (req, res, next) => this.feedbackCtrl.rateByStudent(req, res, next)
    );

    // ── Configuracion del Sistema IA (Solo Administradores) ────────────────
    this.router.put(    '/config/ia-model',  authorizeRole(['admin']), validateBody(schemas.iaModel), (req, res, next) => this.configCtrl.setIAModel(req, res, next));
    this.router.get(    '/config/tokens',    authorizeRole(['admin']), (req, res, next) => this.configCtrl.getTokens(req, res, next));
    this.router.post(   '/config/tokens',    authorizeRole(['admin']), validateBody(schemas.iaToken), (req, res, next) => this.configCtrl.saveToken(req, res, next));

    // ── Configuración Avanzada de IA (RF04) (Solo Administradores) ─────────
    this.router.get(    '/config/ia-advanced', authorizeRole(['admin', 'teacher']), (req, res, next) => this.iaConfigCtrl.getConfig(req, res, next));
    this.router.put(    '/config/ia-advanced', authorizeRole(['admin']), validateBody(schemas.iaAdvancedConfig), (req, res, next) => this.iaConfigCtrl.updateConfig(req, res, next));

    // ── Configuración de Permisos de Rol (RF52) (Solo Administradores) ─────
    this.router.get(    '/config/permissions', authorizeRole(['admin']), (req, res, next) => this.permissionsCtrl.getAllPermissions(req, res, next));
    this.router.put(    '/config/permissions/:role', authorizeRole(['admin']), (req, res, next) => this.permissionsCtrl.updatePermissions(req, res, next));

    // ── Configuración de Variables por Curso (RF34, RF35, RF66) ────────────
    this.router.get(    '/courses/:courseId/variables', authorizeRole(['teacher', 'admin']), (req, res, next) => this.variableCtrl.getVariables(req, res, next));
    this.router.put(    '/courses/:courseId/variables', authorizeRole(['teacher', 'admin']), validateBody(schemas.courseVariables), (req, res, next) => this.variableCtrl.saveVariables(req, res, next));

    logger.debug('Rutas protegidas de la API configuradas correctamente');
  }

  getRouter() {
    return this.router;
  }
}
