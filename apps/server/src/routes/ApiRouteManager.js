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
import SystemNotificationController from '../controllers/SystemNotificationController.js';
import StudentController from '../controllers/StudentController.js';
import FileController from '../controllers/FileController.js';
import PreferencesController from '../modules/preferences/PreferencesController.js';
import PreferencesService from '../modules/preferences/PreferencesService.js';
import { initializeReportsModule } from '../modules/reports/index.js';
import { requireCanvasOAuth } from '../middlewares/CanvasOAuthMiddleware.js';
import { auditLogMiddleware } from '../middlewares/AuditLogMiddleware.js';
import { tenantMiddleware } from '../middlewares/TenantMiddleware.js';
import { webhookLimiter, authLimiter } from '../middlewares/security.js';
import ltiRouter from './lti/index.js';
import { nowIso } from '../utils/datetime.js';
import logger from '../utils/logger.js';

import { createCourseRoutes } from './api/course.routes.js';
import { createTemplateRoutes } from './api/template.routes.js';
import { createFeedbackRoutes, createStudentFeedbackRoutes } from './api/feedback.routes.js';
import { createStatsRoutes, createAuditRoutes } from './api/stats.routes.js';
import { createConfigRoutes } from './api/config.routes.js';
import { createPreferencesRoutes } from './api/preferences.routes.js';
import { createPrivateNotesRoutes } from './api/private_notes.routes.js';
import PrivateNoteController from '../controllers/PrivateNoteController.js';
import { createGlobalVariablesRoutes } from './api/global_variables.routes.js';

export default class ApiRouteManager {
  constructor(dependencies) {
    this.router = express.Router();
    this.dependencies = dependencies;
    this.initializeControllers();
    this.configurePublicRoutes();
    this.configureProtectedRoutes();
  }

  initializeControllers() {
    this.courseCtrl    = new CourseController(this.dependencies.canvasService, this.dependencies.configRepo, this.dependencies.templateManager?.templateRepo, this.dependencies.courseService);
    this.templateCtrl  = new TemplateController(this.dependencies.templateManager);
    this.feedbackCtrl  = new FeedbackController(this.dependencies.feedbackService, this.dependencies.canvasService);
    this.studentCtrl   = new StudentController(this.dependencies.feedbackService);
    this.configCtrl    = new ConfigController(this.dependencies.iaConfigManager, this.dependencies.configRepo);
    this.iaConfigCtrl  = new IAConfigController(this.dependencies.llmConfigService);
    this.variableCtrl  = new VariableConfigController(this.dependencies.variableConfigManager);
    this.advancedFbCtrl = new AdvancedFeedbackController(this.dependencies.feedbackWorkflowService);
    this.manualFbCtrl   = new ManualFeedbackController(this.dependencies.feedbackService);
    this.statsCtrl      = new StatsController(this.dependencies.statsService);
    this.permissionsCtrl = new PermissionsController(this.dependencies.permissionsService);
    
    // Instantiate preferences dependencies
    const prefService = new PreferencesService();
    this.preferencesCtrl = new PreferencesController(prefService);

    this.privateNoteCtrl = new PrivateNoteController(this.dependencies.privateNoteService);
    
    // Conditional injection of the audit controller based on environment
    if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'local') {
      this.auditLogCtrl = new AuditLogControllerLocal();
    } else {
      this.auditLogCtrl = new AuditLogController();
    }

    this.webhookCtrl    = this.dependencies.webhookController;
    this.canvasOAuthCtrl = new CanvasOAuthController(this.dependencies.canvasTokenRepo, this.dependencies.canvasClient);
    this.systemNotificationCtrl = new SystemNotificationController(this.dependencies.systemNotificationService);
    this.fileCtrl        = new FileController(this.dependencies.canvasService);
    this.reportsRouter   = initializeReportsModule(this.dependencies.statsService.feedbackRepo);
    logger.debug('API controllers initialized');
  }

  configurePublicRoutes() {
    this.router.get('/health', (req, res) => {
      logger.debug('Health check requested');
      res.json({
        status: 'Operational API',
        timestamp: nowIso(),
        version: '1.0.0',
        uptime: Math.floor(process.uptime()) + 's'
      });
    });

    ['post', 'put', 'delete', 'patch'].forEach(method => {
      // eslint-disable-next-line security/detect-object-injection
      this.router[method]('/health', (req, res) => {
        res.status(405).json({ exito: false, error: { codigo: 405, mensaje: 'Method not allowed' } });
      });
    });

    this.router.get('/oauth2/canvas/login', (req, res, next) => this.canvasOAuthCtrl.login(req, res, next));
    this.router.get('/oauth2/canvas/callback', (req, res, next) => this.canvasOAuthCtrl.callback(req, res, next));

    this.router.use('/lti', authLimiter, ltiRouter);
  }

  configureProtectedRoutes() {
    this.router.use(auditLogMiddleware);
    this.router.use(tenantMiddleware); // RLS Context Injection

    const canvasOAuth = requireCanvasOAuth(this.dependencies.canvasTokenManager || this.dependencies.canvasTokenRepo);

    this.router.use('/courses', createCourseRoutes(this.courseCtrl, this.fileCtrl, canvasOAuth));
    this.router.use('/templates', createTemplateRoutes(this.templateCtrl));
    this.router.use('/feedback', createFeedbackRoutes(this.feedbackCtrl, this.advancedFbCtrl, this.manualFbCtrl));
    this.router.use('/stats', createStatsRoutes(this.statsCtrl));
    this.router.use('/audit', createAuditRoutes(this.auditLogCtrl));
    this.router.use('/student', createStudentFeedbackRoutes(this.studentCtrl));
    this.router.use('/config', createConfigRoutes(this.configCtrl, this.iaConfigCtrl, this.permissionsCtrl, this.variableCtrl));
    this.router.use('/preferences', createPreferencesRoutes(this.preferencesCtrl));
    this.router.use('/private-notes', createPrivateNotesRoutes(this.privateNoteCtrl));
    this.router.use('/system-notifications', this.systemNotificationCtrl.getRouter());
    this.router.use('/global-variables', createGlobalVariablesRoutes());
    
    // Double mounting removed (Phase 4.1)

    this.router.use('/reports', this.reportsRouter);
    
    this.router.post('/webhooks/canvas', webhookLimiter, (req, res, next) => this.webhookCtrl.handleWebhook(req, res, next));

    logger.debug('Protected API routes configured successfully');
  }

  getRouter() {
    return this.router;
  }
}
