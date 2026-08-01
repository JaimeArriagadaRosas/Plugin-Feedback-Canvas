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
import AuditLogControllerLocal from '../controllers/AuditLogController_local.js';
import CanvasOAuthController from '../controllers/CanvasOAuthController.js';
import StudentController from '../controllers/StudentController.js';
import FileController from '../controllers/FileController.js';
import PreferencesController from '../modules/preferences/PreferencesController.js';
import PreferencesService from '../modules/preferences/PreferencesService.js';
import { initializeReportsModule } from '../modules/reports/index.js';
import { requireCanvasOAuth } from '../middlewares/CanvasOAuthMiddleware.js';
import { authorizeRole } from '../authz/authorizeRole.js';
import { auditLogMiddleware } from '../middlewares/AuditLogMiddleware.js';
import { tenantMiddleware } from '../middlewares/TenantMiddleware.js';
import { webhookLimiter, authLimiter, handleValidationErrors, validateId, validateCourseId, validateAssignmentId, validateStudentId, validateFeedbackDetailQuery } from '../middlewares/security.js';
import { schemas, validateBody, requireDeploymentId } from '../security/validation.js';
import ltiRouter from './lti/index.js';
import { nowIso } from '../utils/datetime.js';
import logger from '../utils/logger.js';

import { createCourseRoutes } from './api/course.routes.js';
import { createTemplateRoutes } from './api/template.routes.js';
import { createFeedbackRoutes, createStudentFeedbackRoutes } from './api/feedback.routes.js';
import { createStatsRoutes, createAuditRoutes } from './api/stats.routes.js';
import { createConfigRoutes } from './api/config.routes.js';
import { createPreferencesRoutes } from './api/preferences.routes.js';

export default class GestorRutasAPI {
  constructor(dependencias) {
    this.router = express.Router();
    this.deps = dependencias;
    this.inicializarControladores();
    this.configurarRutasPublicas();
    this.configurarRutasProtegidas();
  }

  inicializarControladores() {
    this.courseCtrl    = new CourseController(this.deps.canvasService, this.deps.configRepo, this.deps.templateManager?.templateRepo, this.deps.courseService);
    this.templateCtrl  = new TemplateController(this.deps.templateManager);
    this.feedbackCtrl  = new FeedbackController(this.deps.feedbackService, this.deps.canvasService);
    this.studentCtrl   = new StudentController(this.deps.feedbackService);
    this.configCtrl    = new ConfigController(this.deps.iaConfigManager, this.deps.configRepo);
    this.iaConfigCtrl  = new IAConfigController(this.deps.llmConfigService);
    this.variableCtrl  = new VariableConfigController(this.deps.variableConfigManager);
    this.advancedFbCtrl = new AdvancedFeedbackController(this.deps.feedbackWorkflowService);
    this.manualFbCtrl   = new ManualFeedbackController(this.deps.feedbackService);
    this.statsCtrl      = new StatsController(this.deps.statsService);
    this.permissionsCtrl = new PermissionsController(this.deps.permissionsService);
    
    // Instanciar dependencias de preferencias
    const prefService = new PreferencesService();
    this.preferencesCtrl = new PreferencesController(prefService);

    
    // Inyección condicional del controlador de auditoría según entorno
    if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'local') {
      this.auditLogCtrl = new AuditLogControllerLocal();
    } else {
      this.auditLogCtrl = new AuditLogController();
    }

    this.webhookCtrl    = this.deps.webhookController;
    this.canvasOAuthCtrl = new CanvasOAuthController(this.deps.canvasTokenRepo, this.deps.canvasClient);
    this.fileCtrl        = new FileController(this.deps.canvasService);
    this.reportsRouter   = initializeReportsModule(this.deps.statsService.feedbackRepo);
    logger.debug('Controladores de API inicializados');
  }

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

    ['post', 'put', 'delete', 'patch'].forEach(method => {
      // eslint-disable-next-line security/detect-object-injection
      this.router[method]('/health', (req, res) => {
        res.status(405).json({ exito: false, error: { codigo: 405, mensaje: 'Método no permitido' } });
      });
    });

    this.router.get('/oauth2/canvas/login', (req, res, next) => this.canvasOAuthCtrl.login(req, res, next));
    this.router.get('/oauth2/canvas/callback', (req, res, next) => this.canvasOAuthCtrl.callback(req, res, next));

    this.router.use('/lti', authLimiter, ltiRouter);
  }

  configurarRutasProtegidas() {
    this.router.use(auditLogMiddleware);
    this.router.use(tenantMiddleware); // RLS Context Injection

    const canvasOAuth = requireCanvasOAuth(this.deps.canvasTokenManager || this.deps.canvasTokenRepo);

    this.router.use('/courses', createCourseRoutes(this.courseCtrl, this.fileCtrl, canvasOAuth));
    this.router.use('/templates', createTemplateRoutes(this.templateCtrl));
    this.router.use('/feedback', createFeedbackRoutes(this.feedbackCtrl, this.advancedFbCtrl, this.manualFbCtrl));
    this.router.use('/stats', createStatsRoutes(this.statsCtrl));
    this.router.use('/audit', createAuditRoutes(this.auditLogCtrl));
    this.router.use('/student', createStudentFeedbackRoutes(this.studentCtrl));
    this.router.use('/config', createConfigRoutes(this.configCtrl, this.iaConfigCtrl, this.permissionsCtrl, this.variableCtrl));
    this.router.use('/preferences', createPreferencesRoutes(this.preferencesCtrl));
    
    // Doble montaje eliminado (Phase 4.1)

    this.router.use('/reports', this.reportsRouter);
    
    this.router.post('/webhooks/canvas', webhookLimiter, (req, res, next) => this.webhookCtrl.handleWebhook(req, res, next));

    logger.debug('Rutas protegidas de la API configuradas correctamente');
  }

  getRouter() {
    return this.router;
  }
}
