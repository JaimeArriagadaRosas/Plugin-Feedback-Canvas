import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

process.env.NODE_ENV = 'test';
process.env.VITE_USE_LOCAL_DATA = 'true';
process.env.USE_LOCAL_DATA = 'true';
process.env.LOCAL_USER_ROLE = 'admin';
process.env.GEMINI_API_KEY = 'test-key';
process.env.ENCRYPTION_KEY = 'a'.repeat(64);

import db from '../../data/db.js';
import { ErrorHandler } from '../../middlewares/ErrorHandler.js';
import { AuthLTI13Handler } from '../../middlewares/AuthLTI13Handler.js';
import { classifyRoles, resolveViewRole } from '../../utils/roles.js';
import { handleValidationErrors, validateKnownFields } from '../../middlewares/security.js';

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
import SystemConfigController from '../../controllers/SystemConfigController.js';

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
const studentRepo = new StudentRepository(db);

const canvasService = new CanvasServiceLocal();
const iaProvider = { generateFeedback: async () => 'Feedback de prueba generado automaticamente para el estudiante.' };
const academicHistoryService = { getStudentAcademicProfile: async () => ({ level: 'PROMEDIO', trend: 'Estable', average: 7.0 }) };
const validadorAcademico = { generateStudentProfile: (h) => h };
const feedbackService = new FeedbackService(
  iaProvider, canvasService, feedbackRepo, templateRepo,
  academicHistoryService, validadorAcademico, configRepo
);
const iaConfigManager = new IAConfigManager(tokenRepo, configRepo);
const llmConfigService = new LLMConfigurationService();
const variableConfigManager = new VariableConfigManager();
const feedbackWorkflowService = new FeedbackWorkflowService(feedbackRepo, feedbackService, canvasService);
const webhookController = new CanvasWebhookController(feedbackService);

const dependencias = {
  canvasService, feedbackService, templateManager: new TemplateManager(templateRepo),
  iaConfigManager, configRepo, llmConfigService, variableConfigManager,
  feedbackWorkflowService, feedbackRepo, webhookController
};

import LocalAuthController from '../../controllers/AuthController_local.js';

const localAuth = new LocalAuthController();
app.post('/api/auth/local-login', (req, res, next) => localAuth.localLogin(req, res, next));
app.post('/api/auth/local-logout', (req, res, next) => localAuth.localLogout(req, res, next));

app.use('/api', AuthLTI13Handler);

const gestorRutas = new GestorRutasAPI(dependencias);
app.use('/api', gestorRutas.getRouter());

const systemConfig = new SystemConfigController();
app.get('/api/config/startup-mode', (req, res) => systemConfig.getStartupMode(req, res));
app.post('/api/config/set-local-role', validateKnownFields(['role']), handleValidationErrors, (req, res) => systemConfig.setLocalRole(req, res));
app.post('/api/config/clear-local-role', (req, res) => systemConfig.clearLocalRole(req, res));
app.get('/api/config/me', (req, res) => systemConfig.getMe(req, res));

app.use(ErrorHandler);

export const request = (await import('supertest')).default;
export { app };
