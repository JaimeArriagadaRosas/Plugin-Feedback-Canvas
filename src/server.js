import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';

import logger from './utils/logger.js';

// Middlewares
import { ErrorHandler } from './middlewares/ErrorHandler.js';
import { AuthLTI13Handler } from './middlewares/AuthLTI13Handler.js';

// Servicios y Repositorios
import CanvasService from './servicios/CanvasService.js';
import CanvasServiceLocal from './servicios/CanvasService.local.js';
import FeedbackService from './servicios/FeedbackService.js';
import TemplateManager from './servicios/TemplateManager.js';
import IAConfigManager from './servicios/IAConfigManager.js';
import AcademicHistoryService from './servicios/AcademicHistoryService.js';
import ValidadorAcademico from './servicios/ValidadorAcademico.js';
import GeminiProvider from './servicios/ia/GeminiProvider.js';
import CanvasLocalManager from './servicios/CanvasLocalManager.js';
import CanvasConfigurator from './servicios/CanvasConfigurator.js';

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

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE DE LOGGING HTTP — registra todas las peticiones entrantes
// ─────────────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const reqId = logger.request(req);

  // Capturar el fin de la respuesta
  res.on('finish', () => {
    logger.response(req, res, reqId);
  });

  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARES GLOBALES
// ─────────────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:8080'
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL DE INICIO DEL SERVIDOR
// FIX: setupLocalContext ELIMINADO — toda la lógica de sesión está en AuthLTI13Handler
// FIX: Encoding UTF-8 corregido en todos los strings
// ─────────────────────────────────────────────────────────────────────────────
function startServer() {
  const useLocalData = process.env.USE_LOCAL_DATA === 'true' ||
                       process.env.VITE_USE_LOCAL_DATA === 'true';

  logger.info('Iniciando servidor backend del Plugin Feedback...', {
    port: PORT,
    modo: process.env.STARTUP_MODE || '3',
    useLocalData,
    localUserRole: process.env.LOCAL_USER_ROLE || 'N/A'
  });

  // ── 1. Capa de Datos (Repositorios) ──────────────────────────────────────
  const feedbackRepo  = new FeedbackRepository(db);
  const templateRepo  = new TemplateRepository(db);
  const configRepo    = new ConfigRepository(db);
  const tokenRepo     = new TokenRepository(db);
  const studentRepo   = new StudentRepository(db);

  logger.info('Repositorios de datos inicializados', {
    db: db.isLocalMode() ? 'LOCAL (sin PostgreSQL)' : 'PostgreSQL real'
  });

  // ── 2. Selección de Servicios ─────────────────────────────────────────────
  // En modo local se usa CanvasServiceLocal (datos de prueba realistas).
  // En modo real se usa CanvasService con el token de acceso de Canvas.
  const canvasService = useLocalData
    ? new CanvasServiceLocal()
    : new CanvasService(
        process.env.VITE_CANVAS_ACCESS_TOKEN,
        process.env.VITE_CANVAS_BASE_URL
      );

  logger.info(`Servicio Canvas: ${useLocalData ? 'CanvasServiceLocal (datos locales)' : 'CanvasService (API real)'}`);

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

  // ── 3. Middleware de Autenticación LTI 1.3 ───────────────────────────────
  // AuthLTI13Handler ya gestiona tanto sesiones locales como tokens JWT reales.
  // Las rutas públicas (/lti/login, /lti/callback, /health, etc.) pasan sin token.
  app.use('/api', AuthLTI13Handler);

  // ── 4. Rutas de la API ────────────────────────────────────────────────────
  const gestorRutas = new GestorRutasAPI(dependencias);
  app.use('/api', gestorRutas.getRouter());

  // ── 5. Endpoint de estado del sistema ────────────────────────────────────
  app.get('/api/config/startup-mode', (req, res) => {
    res.json({
      mode: process.env.STARTUP_MODE || '3',
      useLocalData,
      localRole: process.env.LOCAL_USER_ROLE || 'admin',
      initializing: global.isCanvasInitializing === true,
      dbMode: db.isLocalMode() ? 'local' : 'postgresql',
      serverTime: new Date().toISOString()
    });
  });

  // ── 6. Endpoint de configuración de sesión local ──────────────────────────
  const setLocalRoleHandler = (req, res) => {
    const { role } = req.body;
    if (!role) {
      return res.status(400).json({ exito: false, error: { mensaje: 'Se requiere el campo "role"' } });
    }

    process.env.LOCAL_USER_ROLE = role;
    process.env.USE_LOCAL_DATA = 'true';
    process.env.VITE_USE_LOCAL_DATA = 'true';

    res.cookie('dev-token', 'true', { path: '/', httpOnly: false });
    logger.info(`Sesión local configurada mediante API`, { role, ip: req.ip });
    res.json({ exito: true, role, mensaje: `Sesión local establecida como ${role}` });
  };

  const clearLocalRoleHandler = (req, res) => {
    process.env.USE_LOCAL_DATA = 'false';
    process.env.VITE_USE_LOCAL_DATA = 'false';
    res.clearCookie('dev-token');
    res.clearCookie('lti_token');
    logger.info('Sesión local limpiada', { ip: req.ip });
    res.json({ exito: true, mensaje: 'Sesión local eliminada' });
  };

  app.post('/api/config/set-local-role', setLocalRoleHandler);
  app.post('/api/config/clear-local-role', clearLocalRoleHandler);

  // ── 7. Endpoint de identidad del usuario ─────────────────────────────────
  app.get('/api/config/me', (req, res) => {
    // Si hay un ltiContext válido (establecido por AuthLTI13Handler), devolver el rol
    if (req.ltiContext) {
      let userRoles = req.ltiContext.role || [];
      if (!Array.isArray(userRoles)) userRoles = [userRoles];

      let role = 'teacher'; // fallback default

      if (req.ltiContext.isLocalSession && req.ltiContext.localRole) {
        // 1. MODO LOCAL: Respetar exactamente el botón que el usuario clickeó
        role = req.ltiContext.localRole;
      } else {
        // 2. LTI REAL: Determinar rol basado en los Claims de IMS Global y el contexto
        const isTeacher = userRoles.some(r => r.includes('Instructor'));
        const isAdmin   = userRoles.some(r => r.includes('Admin'));
        const isStudent = userRoles.some(r => r.includes('Learner'));
        
        const hasCourseContext = !!req.ltiContext.courseId;

        if (hasCourseContext) {
          // Lanzado desde la navegación del curso (Course Navigation)
          // En un curso, un Admin que también es Docente (o que entra a evaluar) debe ver la vista Docente.
          if (isStudent) {
            role = 'student';
          } else if (isTeacher || isAdmin) {
            // Incluso si es solo admin, si entra al curso, actúa como docente del curso.
            role = 'teacher';
          }
        } else {
          // Lanzado desde la navegación global (Global Navigation)
          if (isAdmin) {
            role = 'admin';
          } else if (isStudent) {
            role = 'student';
          } else {
            role = 'teacher';
          }
        }
      }

      logger.info(`/api/config/me → rol resuelto: ${role}`, {
        user: req.ltiContext.user,
        isLocal: req.ltiContext.isLocalSession
      });

      return res.json({
        exito: true,
        user: req.ltiContext.user,
        role,
        roles: userRoles,
        courseId: req.ltiContext.courseId,
        studentId: req.ltiContext.studentId ?? null,
        isLocalSession: req.ltiContext.isLocalSession ?? false
      });
    }

    // Sin ltiContext — sesión no establecida
    logger.warn('/api/config/me llamado sin ltiContext válido');
    res.status(401).json({
      exito: false,
      error: {
        mensaje: 'Sin sesión activa. Inicie el plugin desde Canvas LMS o configure el modo local.',
        codigo: 401
      }
    });
  });

  // ── 8. Handler para LTI Launch directo en / ───────────────────────────────
  app.post('/', (req, res) => {
    logger.info('Petición LTI POST en /, redirigiendo al frontend...');
    res.redirect('http://localhost:5173/');
  });

  // ── 9. Middleware de Errores (siempre al final) ───────────────────────────
  app.use(ErrorHandler);

  // ── 10. Arranque del servidor ──────────────────────────────────────────────
  app.listen(PORT, () => {
    const modeName = process.env.STARTUP_MODE === '1' ? 'LTI 1.3 (Canvas Real)' :
                     process.env.STARTUP_MODE === '2' ? 'API Canvas (Token Manual)' :
                     process.env.STARTUP_MODE === '3' ? 'Canvas Local (Docker)' : 'Local';

    logger.info('═══════════════════════════════════════════════════');
    logger.info('🚀 BACKEND INICIADO — Plugin Feedback Adaptativo');
    logger.info('═══════════════════════════════════════════════════');
    logger.info(`Puerto interno: ${PORT}`);
    logger.info(`Modo de inicio: ${modeName}`);
    logger.info(`Base de datos: ${db.isLocalMode() ? 'Datos locales (sin PostgreSQL)' : 'PostgreSQL real'}`);
    logger.info(`Sesión local: ${useLocalData ? `Activa (rol: ${process.env.LOCAL_USER_ROLE || 'admin'})` : 'Inactiva'}`);
    logger.info('───────────────────────────────────────────────────');
    logger.info('👉 Interfaz de usuario: http://localhost:5173/');
    logger.info(`📋 Logs del backend: ${logger.logFile || 'Solo consola'}`);
    logger.info('═══════════════════════════════════════════════════');
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ARRANQUE AUTOMÁTICO (modo NON_INTERACTIVE)
// ─────────────────────────────────────────────────────────────────────────────
if (process.env.NON_INTERACTIVE === 'true') {
  const mode = process.env.STARTUP_MODE || '3';
  process.env.STARTUP_MODE = mode;

  if (mode === '3') {
    CanvasConfigurator.copyDefaultConfigs();
    logger.info('[Inicio] Gestionando contenedores de Canvas local en Docker...');
    global.isCanvasInitializing = true;
    startServer();
    CanvasLocalManager.autoStartAndInitialize()
      .then(() => {
        global.isCanvasInitializing = false;
        logger.info('[Inicio] Canvas local listo y proxy habilitado.');
      })
      .catch((error) => {
        global.isCanvasInitializing = false;
        logger.error('[Inicio] Error crítico al iniciar Canvas local:', { error: error.message });
      });
  } else {
    logger.info('[Inicio] Entorno configurado. Esperando conexiones de autenticación...');
    startServer();
  }
}

export default app;
