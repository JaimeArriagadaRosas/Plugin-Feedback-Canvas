import db from '../../data/db.js';
import CanvasClient from '../infrastructure/CanvasClient.js';
import CanvasTokenManager from '../auth/CanvasTokenManager.js';
import CanvasLmsAdapter from '../../adapters/CanvasLmsAdapter.js';
import FeedbackService from '../FeedbackService.js';
import TemplateManager from '../TemplateManager.js';
import IAConfigManager from '../IAConfigManager.js';
import AcademicHistoryService from '../AcademicHistoryService.js';
import ValidadorAcademico from '../ValidadorAcademico.js';
import LLMConfigurationService from '../LLMConfigurationService.js';
import CourseVariablesService from '../variables/CourseVariablesService.js';
import FeedbackWorkflowService from '../FeedbackWorkflowService.js';
import TemplateValidatorService from '../TemplateValidatorService.js';
import CanvasWebhookController from '../../controllers/CanvasWebhookController.js';
import StatsService from '../StatsService.js';
import PermissionsManager from '../../modules/permissions/PermissionsManager.js';
import PermissionsManagerLocal from '../../modules/permissions/PermissionsManager.local.js';
import PreferencesService from '../../modules/preferences/PreferencesService.js';
import EmailServiceLocal from '../../modules/notifications/EmailService.local.js';
import NotificationDiagnosticsLocal from '../../modules/notifications/NotificationDiagnostics.local.js';
import TokenRotationJob from '../auth/TokenRotationJob.js';
import PrivateNoteService from '../PrivateNoteService.js';
import WebhookService from '../WebhookService.js';
import CourseService from '../CourseService.js';

import FeedbackRepository from '../../data/FeedbackRepository.js';
import TemplateRepository from '../../data/TemplateRepository.js';
import ConfigRepository from '../../data/ConfigRepository.js';
import TokenRepository from '../../data/TokenRepository.js';
import CanvasTokenRepository from '../../data/CanvasTokenRepository.js';
import StudentRepository from '../../data/StudentRepository.js';
import PermissionsRepository from '../../data/PermissionsRepository.js';
import SystemNotificationRepository from '../../data/SystemNotificationRepository.js';
import SystemNotificationService from '../SystemNotificationService.js';

import { isLocalModeAllowed } from '../../security/envGuard.js';
import logger from '../../utils/logger.js';

export function initializeDataLayer() {
  const feedbackRepo  = new FeedbackRepository(db);
  const templateRepo  = new TemplateRepository(db);
  const configRepo    = new ConfigRepository(db);
  const tokenRepo     = new TokenRepository(db);
  const canvasTokenRepo = new CanvasTokenRepository();
  const studentRepo   = new StudentRepository(db);
  const permissionsRepo = new PermissionsRepository(db);
  const systemNotificationRepo = new SystemNotificationRepository();

  logger.info('[DATA] Repositorios de datos inicializados.', {
    db: 'PostgreSQL real'
  });

  return { feedbackRepo, templateRepo, configRepo, tokenRepo, canvasTokenRepo, studentRepo, permissionsRepo, systemNotificationRepo };
}

export async function initializeServiceLayer(env, repos) {
  const { feedbackRepo, templateRepo, configRepo, tokenRepo, canvasTokenRepo, permissionsRepo } = repos;

  const canvasClient = new CanvasClient(env.canvasBaseUrl, env.canvasApiHost);
  const canvasTokenManager = new CanvasTokenManager(canvasTokenRepo, env, canvasClient);

  const canvasGateway = new CanvasLmsAdapter(canvasClient, canvasTokenManager, env);
  logger.info(`[CANVAS] Servicio inicializado: CanvasLmsAdapter (Paridad Producción)`);

  const academicHistoryService = new AcademicHistoryService(canvasGateway, repos.studentRepo);
  const templateManager = new TemplateManager(templateRepo);

  const iaConfigManager = new IAConfigManager(tokenRepo, configRepo);
  
  const preferencesService = new PreferencesService();
  const emailServiceLocal = new EmailServiceLocal();
  const diagnosticsService = process.env.NODE_ENV !== 'production' ? new NotificationDiagnosticsLocal() : null;
  const systemNotificationService = new SystemNotificationService(repos.systemNotificationRepo);

  const feedbackService = new FeedbackService(
    canvasGateway,
    feedbackRepo,
    templateRepo,
    academicHistoryService,
    ValidadorAcademico,
    configRepo,
    iaConfigManager,
    preferencesService,
    emailServiceLocal,
    systemNotificationService
  );

  const llmConfigService = new LLMConfigurationService();
  const variableConfigManager = new CourseVariablesService();
  const feedbackWorkflowService = new FeedbackWorkflowService(feedbackRepo, feedbackService, canvasGateway, preferencesService, emailServiceLocal, diagnosticsService);
  const templateValidatorService = new TemplateValidatorService();
  const webhookService = new WebhookService();
  const courseService = new CourseService(configRepo);
  const webhookController = new CanvasWebhookController(feedbackService, configRepo, webhookService);
  const statsService = new StatsService(feedbackRepo);
  const permissionsService = isLocalModeAllowed()
    ? new PermissionsManagerLocal(permissionsRepo)
    : new PermissionsManager(permissionsRepo);
  const tokenRotationJob = new TokenRotationJob(canvasTokenManager);
  const privateNoteService = new PrivateNoteService(feedbackRepo);

  return {
    canvasService: canvasGateway, feedbackService, templateManager, iaConfigManager,
    configRepo, llmConfigService, variableConfigManager,
    feedbackWorkflowService, templateValidatorService, feedbackRepo,
    webhookController, statsService, permissionsService, canvasTokenRepo,
    canvasTokenManager, canvasClient, tokenRotationJob, webhookService, courseService,
    privateNoteService, systemNotificationService
  };
}
