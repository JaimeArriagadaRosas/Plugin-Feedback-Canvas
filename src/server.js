import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';

// Middlewares
import { ErrorHandler } from './middlewares/ErrorHandler.js';
import { AuthLTI13Handler } from './middlewares/AuthLTI13Handler.js';

// Servicios y Repositorios
import CanvasService from './servicios/CanvasService.js';
import CanvasServiceMock from './servicios/CanvasService.mock.js';
import FeedbackService from './servicios/FeedbackService.js';
import TemplateManager from './servicios/TemplateManager.js';
import IAConfigManager from './servicios/IAConfigManager.js';
import AcademicHistoryService from './servicios/AcademicHistoryService.js';
import ValidadorAcademico from './servicios/ValidadorAcademico.js';
import GeminiProvider from './servicios/ia/GeminiProvider.js';

import FeedbackRepository from './datos/FeedbackRepository.js';
import TemplateRepository from './datos/TemplateRepository.js';
import ConfigRepository from './datos/ConfigRepository.js';
import TokenRepository from './datos/TokenRepository.js';
import StudentRepository from './datos/StudentRepository.js';
import db from './datos/db.js';

import GestorRutasAPI from './rutas/GestorRutasAPI.js';

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const USE_MOCKS = process.env.VITE_USE_MOCK_DATA === 'true';

// 1. Inicialización de Capa de Datos (Repositorios)
const feedbackRepo = new FeedbackRepository(db);
const templateRepo = new TemplateRepository(db);
const configRepo = new ConfigRepository(db);
const tokenRepo = new TokenRepository(db);
const studentRepo = new StudentRepository(db);

// 2. Selección de Servicios (Real vs Mock)
const canvasService = USE_MOCKS 
  ? new CanvasServiceMock() 
  : new CanvasService(process.env.VITE_CANVAS_ACCESS_TOKEN, process.env.VITE_CANVAS_BASE_URL);

const iaProvider = new GeminiProvider(process.env.GEMINI_API_KEY);
const academicHistoryService = new AcademicHistoryService(canvasService, studentRepo);
const templateManager = new TemplateManager(templateRepo);

// Orquestador Principal
const feedbackService = new FeedbackService(
  iaProvider, 
  canvasService, 
  feedbackRepo, 
  templateRepo,
  academicHistoryService,
  ValidadorAcademico
);

const iaConfigManager = new IAConfigManager(tokenRepo);

const dependencias = {
  canvasService,
  feedbackService,
  templateManager,
  iaConfigManager,
  configRepo
};

// 3. Middlewares Globales
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 4. Inyección de Contexto y Rutas
const gestorRutas = new GestorRutasAPI(dependencias);

app.use('/api', AuthLTI13Handler);
app.use('/api', gestorRutas.getRouter());

// 5. Servir Frontend (Producción)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dist'));
}

app.use(ErrorHandler);

app.listen(PORT, () => {
  console.log(`
  🚀 API FEEDBACK PLUGIN - INICIADA ${USE_MOCKS ? '(MODO MOCK ACTIVADO)' : ''}
  ----------------------------------
  Puerto: ${PORT}
  API Base: http://localhost:${PORT}/api
  Health Check: http://localhost:${PORT}/api/health
  ----------------------------------
  `);
});

export default app;
