import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import readline from 'readline';

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
import CanvasLocalManager from './servicios/CanvasLocalManager.js';

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

// Middleware para establecer contexto de mock en desarrollo
const setupMockContext = (req, res, next) => {
  if (process.env.VITE_USE_MOCK_DATA === 'true' || process.env.STARTUP_MODE === '3') {
    const mockUserRole = process.env.MOCK_USER_ROLE || 'admin';
    const roles = {
      admin: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Administrator'],
      teacher: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'],
      student: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner']
    };
    req.ltiContext = { 
      user: `dev-user-${mockUserRole}`, 
      role: roles[mockUserRole] || roles.admin,
      courseId: '1' // Usualmente el primer curso en canvas local
    };
    return next();
  }
  next();
};

// Middlewares Globales
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Middleware de contexto de mock (debe ir antes de las rutas que lo necesiten)
app.use('/api', setupMockContext);

function startServer() {
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

  const feedbackService = new FeedbackService(
    iaProvider, 
    canvasService, 
    feedbackRepo, 
    templateRepo,
    academicHistoryService,
    ValidadorAcademico,
    configRepo
  );

  const iaConfigManager = new IAConfigManager(tokenRepo);

  const dependencias = {
    canvasService,
    feedbackService,
    templateManager,
    iaConfigManager,
    configRepo
  };

  // 5. AuthLTI13Handler (solo en producción, en modo mock o local bypass no se usa)
  if (!USE_MOCKS && process.env.STARTUP_MODE !== '3') {
    app.use('/api', AuthLTI13Handler);
  }

  // 6. Inyección de Contexto y Rutas
  const gestorRutas = new GestorRutasAPI(dependencias);
  app.use('/api', gestorRutas.getRouter());

  // Handler para el LTI Launch (Canvas hace un POST a la raíz de la herramienta)
  app.post('/', (req, res) => {
    console.log('[LTI Launch] Petición POST recibida desde Canvas, redirigiendo al Frontend...');
    
    if (process.env.STARTUP_MODE === '3') {
      console.log('[LTI Launch] Canvas Local detectado. Estableciendo dev-token para omitir validación LTI en Frontend.');
      res.cookie('dev-token', 'true', { path: '/' });
    }
    
    // Redirección HTTP 302 que convierte el POST en un GET hacia Vite
    res.redirect('http://localhost:5173/');
  });

  app.get('/api/config/startup-mode', (req, res) => {
    res.json({ 
      mode: process.env.STARTUP_MODE || '3', 
      useMock: process.env.VITE_USE_MOCK_DATA === 'true',
      role: process.env.MOCK_USER_ROLE || 'admin',
      initializing: global.isCanvasInitializing === true
    });
  });

  app.post('/api/config/set-mock-role', (req, res) => {
    const { role } = req.body;
    process.env.MOCK_USER_ROLE = role;
    process.env.VITE_USE_MOCK_DATA = 'true';
    res.cookie('dev-token', 'true', { path: '/' });
    res.json({ exito: true, role });
  });

  app.post('/api/config/clear-mock-role', (req, res) => {
    process.env.VITE_USE_MOCK_DATA = 'false';
    res.clearCookie('dev-token');
    res.clearCookie('lti_token');
    res.json({ exito: true });
  });

  app.get('/api/config/me', (req, res) => {
    const userRoles = req.ltiContext?.role || [];
    const isTeacher = userRoles.some(r => r.includes('Instructor'));
    const isAdmin = userRoles.some(r => r.includes('Administrator'));
    const isStudent = userRoles.some(r => r.includes('Learner'));
    
    const role = isAdmin ? 'admin' : isStudent ? 'student' : 'teacher';
    
    res.json({ 
      exito: true, 
      user: req.ltiContext?.user,
      role: role,
      roles: userRoles,
      courseId: req.ltiContext?.courseId
    });
  });

  app.use(ErrorHandler);

  app.listen(PORT, () => {
    const modeName = process.env.STARTUP_MODE === '1' ? 'LTI 1.3 (Real)' :
                     process.env.STARTUP_MODE === '2' ? 'API Canvas (Real)' :
                     process.env.STARTUP_MODE === '3' ? 'Canvas Local (Docker)' : 'MOCKUP (Simulado)';
    console.log(`
  🚀 BACKEND INICIADO (Puerto Interno: ${PORT})
  ----------------------------------
  Modo de Inicio: ${modeName}
  Rol Activo Mock: ${process.env.VITE_USE_MOCK_DATA === 'true' ? process.env.MOCK_USER_ROLE : 'N/A (Usando Autenticador o Canvas Real)'}
  
  ⚠️ ATENCIÓN: Para ver la interfaz de usuario, abre en tu navegador:
  👉 http://localhost:5173/ 👈
  ----------------------------------
  `);
  });
}

if (process.env.NON_INTERACTIVE === 'true') {
  const mode = process.env.STARTUP_MODE || '3';
  process.env.STARTUP_MODE = mode;
  if (mode === '3') {
    CanvasLocalManager.copyDefaultConfigs();
    console.log('\n[Inicio-NoInteractivo] Gestionando contenedores de Canvas local en Docker...');
    global.isCanvasInitializing = true;
    startServer();
    CanvasLocalManager.autoStartAndInitialize()
      .then(() => {
        global.isCanvasInitializing = false;
        console.log('\n[Inicio-NoInteractivo] Canvas local listo y proxy habilitado.');
      })
      .catch((error) => {
        global.isCanvasInitializing = false;
        console.error('\n[Inicio-NoInteractivo] Error crítico al iniciar Canvas local:', error.message);
      });
  } else {
    process.env.VITE_USE_MOCK_DATA = 'false';
    console.log(`\nEntorno Real configurado. Esperando conexiones de autenticación...\n`);
    startServer();
  }
}

export default app;
