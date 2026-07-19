import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

process.env.NODE_ENV = 'test';
process.env.USE_LOCAL_DATA = 'false'; // IMPORTANT for real CanvasService
process.env.LOCAL_USER_ROLE = 'admin';
process.env.GEMINI_API_KEY = 'test-key';
process.env.ENCRYPTION_KEY = 'a'.repeat(64);
process.env.DEV_TOKEN_SECRET = 'test-dev-token-secret';

import db from '../../data/db.js';
import { ErrorHandler } from '../../middlewares/ErrorHandler.js';
import { AuthLTI13Handler } from '../../middlewares/AuthLTI13Handler.js';

import FeedbackRepository from '../../data/FeedbackRepository.js';
import TemplateRepository from '../../data/TemplateRepository.js';
import ConfigRepository from '../../data/ConfigRepository.js';
import TokenRepository from '../../data/TokenRepository.js';
import CanvasTokenRepository from '../../data/CanvasTokenRepository.js';
import StudentRepository from '../../data/StudentRepository.js';

import CanvasLmsAdapter from '../../adapters/CanvasLmsAdapter.js';
import CanvasClient from '../../services/infrastructure/CanvasClient.js';
import CanvasTokenManager from '../../services/auth/CanvasTokenManager.js';
import FeedbackService from '../../services/FeedbackService.js';
import TemplateManager from '../../services/TemplateManager.js';
import IAConfigManager from '../../services/IAConfigManager.js';
import LLMConfigurationService from '../../services/LLMConfigurationService.js';
import VariableConfigManager from '../../services/VariableConfigManager.js';
import FeedbackWorkflowService from '../../services/FeedbackWorkflowService.js';
import CanvasWebhookController from '../../controllers/CanvasWebhookController.js';

import GestorRutasAPI from '../../routes/GestorRutasAPI.js';

const app = express();
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const feedbackRepo = new FeedbackRepository(db);
const templateRepo = new TemplateRepository(db);
const configRepo = new ConfigRepository(db);
const tokenRepo = new TokenRepository(db);
const canvasTokenRepo = new CanvasTokenRepository();
const studentRepo = new StudentRepository(db);

const canvasHttpClient = new CanvasClient('https://canvas.test');
const canvasTokenManager = new CanvasTokenManager(canvasTokenRepo, {});
const canvasGateway = new CanvasLmsAdapter(canvasHttpClient, canvasTokenManager, process.env);
const iaProvider = { generateFeedback: async () => 'Feedback nock mock' };
const academicHistoryService = { getStudentAcademicProfile: async () => ({ level: 'PROMEDIO' }) };
const validadorAcademico = { generateStudentProfile: (h) => h };

const feedbackService = new FeedbackService(
  iaProvider, canvasGateway, feedbackRepo, templateRepo,
  academicHistoryService, validadorAcademico, configRepo
);

const webhookController = new CanvasWebhookController(feedbackService, configRepo);

const dependencias = {
  canvasService: canvasGateway, feedbackService, templateManager: new TemplateManager(templateRepo),
  iaConfigManager: new IAConfigManager(tokenRepo, configRepo), 
  configRepo, llmConfigService: new LLMConfigurationService(), 
  variableConfigManager: new VariableConfigManager(),
  feedbackWorkflowService: new FeedbackWorkflowService(feedbackRepo, feedbackService, canvasGateway), 
  feedbackRepo, webhookController, canvasTokenRepo, canvasClient: canvasHttpClient
};

app.use('/api', AuthLTI13Handler);

const gestorRutas = new GestorRutasAPI(dependencias);
app.use('/api', gestorRutas.getRouter());

app.use(ErrorHandler);

export const request = (await import('supertest')).default;
export { app };
