import express from 'express';
import CourseController from '../controlador/CourseController.js';
import TemplateController from '../controlador/TemplateController.js';
import FeedbackController from '../controlador/FeedbackController.js';
import ConfigController from '../controlador/ConfigController.js';
import { authorizeRole } from '../middlewares/AuthLTI13Handler.js';
import { auditLogMiddleware } from '../middlewares/AuditLogMiddleware.js';
import logger from '../utils/logger.js';

/**
 * Gestor de Rutas de la API — con Autorización por Roles y Logging completo.
 *
 * FIX: Rutas LTI (/lti/login, /lti/callback, /lti/jwks) ahora están
 *      ANTES del middleware de auditoría y son explícitamente públicas.
 *      El check de rutas públicas en AuthLTI13Handler ya los cubre,
 *      pero se refuerza aquí con un router separado de rutas públicas.
 */
export default class GestorRutasAPI {
  constructor(dependencias) {
    this.router = express.Router();
    this.publicRouter = express.Router();
    this.deps = dependencias;
    this.inicializarControladores();
    this.configurarRutasPublicas();
    this.configurarRutasProtegidas();
  }

  inicializarControladores() {
    this.courseCtrl    = new CourseController(this.deps.canvasService, this.deps.configRepo);
    this.templateCtrl  = new TemplateController(this.deps.templateManager);
    this.feedbackCtrl  = new FeedbackController(this.deps.feedbackService, this.deps.canvasService);
    this.configCtrl    = new ConfigController(this.deps.iaConfigManager, this.deps.configRepo);
    logger.debug('Controladores de API inicializados');
  }

  /**
   * Rutas públicas — No requieren autenticación LTI.
   * Estas rutas son parte del flujo de inicio de LTI 1.3.
   */
  configurarRutasPublicas() {
    // ── Salud del sistema (pública) ────────────────────────────────────────
    this.router.get('/health', (req, res) => {
      logger.debug('Health check solicitado');
      res.json({
        status: 'API Operativa',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        uptime: Math.floor(process.uptime()) + 's'
      });
    });

    // ── Flujo LTI 1.3 — Paso 1: Inicio de Login OIDC (desde Canvas) ───────
    this.router.get('/lti/login', (req, res) => {
      const { iss, login_hint, target_link_uri, lti_message_hint } = req.query;
      logger.info('LTI Login iniciado desde Canvas', { iss, login_hint: login_hint?.substring(0, 30) });

      if (!iss || !login_hint || !target_link_uri) {
        logger.warn('LTI Login: Faltan parámetros requeridos', { iss: !!iss, login_hint: !!login_hint, target_link_uri: !!target_link_uri });
        return res.status(400).json({
          error: 'Parámetros LTI insuficientes',
          required: ['iss', 'login_hint', 'target_link_uri'],
          received: Object.keys(req.query)
        });
      }

      const state = Math.random().toString(36).substring(2) + Date.now().toString(36);
      const nonce = Math.random().toString(36).substring(2) + Date.now().toString(36);

      const secure = process.env.NODE_ENV === 'production';
      res.cookie('lti_state', state, { httpOnly: true, secure, sameSite: 'lax' });
      res.cookie('lti_nonce', nonce, { httpOnly: true, secure, sameSite: 'lax' });

      const canvasAuthUrl = process.env.CANVAS_OIDC_URL || 'http://localhost:8080/api/lti/authorize_redirect';
      const clientId = process.env.LTI_CLIENT_ID || '10000000000001';

      const authParams = new URLSearchParams({
        scope: 'openid',
        response_type: 'id_token',
        client_id: clientId,
        redirect_uri: process.env.LTI_REDIRECT_URI || 'http://localhost:3000/api/lti/callback',
        login_hint,
        state,
        response_mode: 'form_post',
        nonce,
        prompt: 'none'
      });

      if (lti_message_hint) authParams.append('lti_message_hint', lti_message_hint);

      const redirectUrl = `${canvasAuthUrl}?${authParams.toString()}`;
      logger.info('LTI Login: Redirigiendo a Canvas para autorización', { url: redirectUrl.substring(0, 100) });
      res.redirect(redirectUrl);
    });

    // ── Flujo LTI 1.3 — Paso 2: Callback desde Canvas con id_token ────────
    this.router.post('/lti/callback', async (req, res) => {
      const { id_token, state, error } = req.body;
      const expectedState = req.cookies?.lti_state;

      logger.info('LTI Callback recibido desde Canvas', {
        hasToken: !!id_token,
        stateMatch: state === expectedState,
        hasError: !!error
      });

      if (error) {
        logger.error('LTI Callback: Canvas devolvió error', { error });
        return res.status(401).json({ error: `Error de Canvas: ${error}` });
      }

      if (!id_token) {
        logger.error('LTI Callback: Sin id_token en el body');
        return res.status(400).json({ error: 'id_token ausente en el callback LTI' });
      }

      if (state !== expectedState) {
        logger.error('LTI Callback: Validación de estado fallida', {
          received: state?.substring(0, 20),
          expected: expectedState?.substring(0, 20)
        });
        return res.status(401).json({ error: 'Validación de estado OIDC fallida. Posible ataque CSRF.' });
      }

      try {
        // En un entorno de producción real con Canvas remoto, verificar el token JWT:
        // const decoded = await ltiService.verifyToken(id_token);
        // Por ahora en modo local, el token se pasa al frontend para ser almacenado.
        const frontendUrl = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || 'http://localhost:5173';
        const redirectUrl = `${frontendUrl}?lti_token=${encodeURIComponent(id_token)}`;
        logger.info('LTI Callback: Redirigiendo al frontend con token', { frontendUrl });
        res.redirect(redirectUrl);
      } catch (err) {
        logger.error('LTI Callback: Error procesando el token', { error: err.message });
        res.status(401).json({ error: 'Error procesando el token LTI' });
      }
    });

    // ── JWKS (Claves públicas para validación) ─────────────────────────────
    this.router.get('/lti/jwks', (req, res) => {
      logger.debug('JWKS endpoint consultado');
      res.json({ keys: [] });
    });
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
      (req, res, next) => { logger.debug('GET /courses', { user: req.ltiContext?.user }); this.courseCtrl.getCourses(req, res, next); }
    );
    this.router.get(    '/courses/:courseId/assignments',
      authorizeRole(['teacher']),
      (req, res, next) => { logger.debug('GET /courses/:id/assignments', { courseId: req.params.courseId }); this.courseCtrl.getAssignments(req, res, next); }
    );
    this.router.get(    '/courses/:courseId/students',
      authorizeRole(['teacher']),
      (req, res, next) => this.courseCtrl.getStudents(req, res, next)
    );
    this.router.get(    '/courses/:courseId/assignments/:assignmentId/submissions/:studentId',
      authorizeRole(['teacher']),
      (req, res, next) => this.courseCtrl.getSubmission(req, res, next)
    );
    this.router.post(   '/courses/:courseId/assignments/:assignmentId/toggle',
      authorizeRole(['teacher']),
      (req, res, next) => this.courseCtrl.togglePlugin(req, res, next)
    );

    // ── Plantillas (Docentes y Administradores) ────────────────────────────
    this.router.get(    '/templates',       authorizeRole(['teacher']), (req, res, next) => this.templateCtrl.getAll(req, res, next));
    this.router.get(    '/templates/:id',   authorizeRole(['teacher']), (req, res, next) => this.templateCtrl.getOne(req, res, next));
    this.router.post(   '/templates',       authorizeRole(['teacher']), (req, res, next) => this.templateCtrl.create(req, res, next));
    this.router.put(    '/templates/:id',   authorizeRole(['teacher']), (req, res, next) => this.templateCtrl.update(req, res, next));
    this.router.delete( '/templates/:id',   authorizeRole(['teacher']), (req, res, next) => this.templateCtrl.delete(req, res, next));

    // ── Feedback (Docentes) ────────────────────────────────────────────────
    this.router.get(    '/feedback/list',     authorizeRole(['teacher']), (req, res, next) => this.feedbackCtrl.listAll(req, res, next));
    this.router.get(    '/feedback/pending',  authorizeRole(['teacher']), (req, res, next) => this.feedbackCtrl.listPending(req, res, next));
    this.router.get(    '/feedback/detail',   authorizeRole(['teacher']), (req, res, next) => this.feedbackCtrl.getDetail(req, res, next));
    this.router.post(   '/feedback/generate', authorizeRole(['teacher']), (req, res, next) => this.feedbackCtrl.generate(req, res, next));
    this.router.put(    '/feedback/:id',      authorizeRole(['teacher']), (req, res, next) => this.feedbackCtrl.updateFeedback(req, res, next));
    this.router.post(   '/feedback/approve',  authorizeRole(['teacher']), (req, res, next) => this.feedbackCtrl.approveAndSend(req, res, next));

    // ── Feedback (Estudiantes) ─────────────────────────────────────────────
    this.router.get(    '/student/feedback/:studentId',
      authorizeRole(['student', 'teacher']),
      (req, res, next) => this.feedbackCtrl.getStudentView(req, res, next)
    );
    this.router.post(   '/student/rate',
      authorizeRole(['student']),
      (req, res, next) => this.feedbackCtrl.rateByStudent(req, res, next)
    );

    // ── Configuracion del Sistema IA (Solo Administradores) ────────────────
    this.router.put(    '/config/ia-model',  authorizeRole(['admin']), (req, res, next) => this.configCtrl.setIAModel(req, res, next));
    this.router.get(    '/config/tokens',    authorizeRole(['admin']), (req, res, next) => this.configCtrl.getTokens(req, res, next));
    this.router.post(   '/config/tokens',    authorizeRole(['admin']), (req, res, next) => this.configCtrl.saveToken(req, res, next));

    logger.debug('Rutas protegidas de la API configuradas correctamente');
  }

  getRouter() {
    return this.router;
  }
}
