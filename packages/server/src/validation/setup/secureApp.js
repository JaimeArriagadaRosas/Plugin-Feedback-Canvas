// Harness de pruebas que ejercita el stack de middleware REAL de produccin
// (Helmet, CORS restringido, lmite de body, rate limiter global) construido con
// createApp() + registerRoutes(), incluyendo una clave JWK LTI real generada por
// generateLtiKeys(). Se usa para probar defensas que NO viven en el router y que
// el harness estndar (setup/app.js) no incluye.

process.env.NODE_ENV = 'test';
process.env.VITE_USE_LOCAL_DATA = 'true';
process.env.USE_LOCAL_DATA = 'true';
process.env.LOCAL_USER_ROLE = 'admin';
process.env.GEMINI_API_KEY = 'test-key';
process.env.ENCRYPTION_KEY = 'a'.repeat(64);

import db from '../../data/db.js';
import { createApp } from '../../services/server/middleware.js';
import { registerRoutes } from '../../services/server/routes.js';
import { generateLtiKeys } from '../../services/server/bootstrap.js';
import { ErrorHandler } from '../../middlewares/ErrorHandler.js';

import FeedbackRepository from '../../data/FeedbackRepository.js';
import TemplateRepository from '../../data/TemplateRepository.js';
import ConfigRepository from '../../data/ConfigRepository.js';
import TokenRepository from '../../data/TokenRepository.js';
import StudentRepository from '../../data/StudentRepository.js';

import CanvasServiceLocal from '../../services/infrastructure/CanvasService_local.js';
import FeedbackService from '../../services/FeedbackService.js';
import TemplateManager from '../../services/TemplateManager.js';
import IAConfigManager from '../../services/IAConfigManager.js';
import LLMConfigurationService from '../../services/LLMConfigurationService.js';
import VariableConfigManager from '../../services/VariableConfigManager.js';
import FeedbackWorkflowService from '../../services/FeedbackWorkflowService.js';
import CanvasWebhookController from '../../controllers/CanvasWebhookController.js';

const { app } = createApp();

const ltiPublicJwk = await generateLtiKeys();
process.env.LTI_PUBLIC_JWK = JSON.stringify(ltiPublicJwk);

const feedbackRepo = new FeedbackRepository(db);
const templateRepo = new TemplateRepository(db);
const configRepo = new ConfigRepository(db);
const tokenRepo = new TokenRepository(db);
const studentRepo = new StudentRepository(db);

const canvasService = new CanvasServiceLocal();
const iaProvider = { generateFeedback: async () => 'Feedback de prueba generado automaticamente para el estudiante.' };
const academicHistoryService = { getStudentAcademicProfile: async () => ({ level: 'PROMEDIO', trend: 'Estable', average: 7.0 }) };
const validadorAcademico = { generateStudentProfile: (h) => h };
const feedbackService = new FeedbackService(
  iaProvider, canvasService, feedbackRepo, templateRepo,
  academicHistoryService, validadorAcademico, configRepo
);

const services = {
  canvasService,
  feedbackService,
  templateManager: new TemplateManager(templateRepo),
  iaConfigManager: new IAConfigManager(tokenRepo, configRepo),
  configRepo,
  llmConfigService: new LLMConfigurationService(),
  variableConfigManager: new VariableConfigManager(),
  feedbackWorkflowService: new FeedbackWorkflowService(feedbackRepo, feedbackService, canvasService),
  feedbackRepo,
  webhookController: new CanvasWebhookController(feedbackService)
};

registerRoutes(app, services, ltiPublicJwk);

app.use(ErrorHandler);

export const request = (await import('supertest')).default;
export { app, ltiPublicJwk };
