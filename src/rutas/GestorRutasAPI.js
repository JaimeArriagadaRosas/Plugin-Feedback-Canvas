import express from 'express';
import CourseController from '../controlador/CourseController.js';
import TemplateController from '../controlador/TemplateController.js';
import FeedbackController from '../controlador/FeedbackController.js';
import ConfigController from '../controlador/ConfigController.js';
import { authorizeRole } from '../middlewares/AuthLTI13Handler.js';
import { auditLogMiddleware } from '../middlewares/AuditLogMiddleware.js';

/**
 * Gestor de Rutas de la API (RF38) con Autorización por Roles
 */
export default class GestorRutasAPI {
  constructor(dependencias) {
    this.router = express.Router();
    this.deps = dependencias;
    this.inicializarControladores();
    this.configurarRutas();
  }

  inicializarControladores() {
    this.courseCtrl = new CourseController(this.deps.canvasService, this.deps.configRepo);
    this.templateCtrl = new TemplateController(this.deps.templateManager);
    this.feedbackCtrl = new FeedbackController(this.deps.feedbackService, this.deps.canvasService);
    this.configCtrl = new ConfigController(this.deps.iaConfigManager, this.deps.configRepo);
  }

  configurarRutas() {
    // Aplicar Middleware de Auditoría a todas las rutas
    this.router.use(auditLogMiddleware);

    // --- Rutas LTI 1.3 ---
    this.router.get('/lti/login', (req, res) => {
      // Paso 1: Canvas inicia el login OIDC
      const { iss, login_hint, target_link_uri, lti_message_hint } = req.query;
      
      if (!iss || !login_hint || !target_link_uri) {
        return res.status(400).send('Faltan parámetros requeridos para LTI Launch');
      }

      // Generar state y nonce para seguridad
      const state = Math.random().toString(36).substring(2);
      const nonce = Math.random().toString(36).substring(2);
      
      // Guardar en cookies para validación posterior
      res.cookie('lti_state', state, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
      res.cookie('lti_nonce', nonce, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });

      // Redirigir a Canvas para autorización
      const canvasAuthUrl = process.env.CANVAS_OIDC_URL || 'https://canvas.instructure.com/api/lti/authorize_redirect';
      const clientId = process.env.LTI_CLIENT_ID || '10000000000001';
      
      const authParams = new URLSearchParams({
        scope: 'openid',
        response_type: 'id_token',
        client_id: clientId,
        redirect_uri: process.env.LTI_REDIRECT_URI || 'http://localhost:3000/api/lti/callback',
        login_hint: login_hint,
        state: state,
        response_mode: 'form_post',
        nonce: nonce,
        prompt: 'none'
      });
      
      if (lti_message_hint) {
        authParams.append('lti_message_hint', lti_message_hint);
      }

      res.redirect(`${canvasAuthUrl}?${authParams.toString()}`);
    });

    this.router.post('/lti/callback', async (req, res) => {
      // Paso 2: Canvas envía el id_token
      const { id_token, state, error } = req.body;
      const expectedState = req.cookies.lti_state;

      if (error) return res.status(401).send(`Error de Canvas: ${error}`);
      if (state !== expectedState) return res.status(401).send('Validación de Estado Fallida');

      try {
        // En un entorno real, descomentar esta línea para validar con Canvas:
        // const decoded = await ltiService.verifyToken(id_token);
        
        // Simular que el token es válido y pasarlo al frontend a través de una cookie o redirección
        // Se guarda el token validado en una cookie que el Frontend Vite puede leer
        res.cookie('lti_token', id_token, { path: '/' });
        
        // Redirigir al frontend principal
        res.redirect(process.env.FRONTEND_URL || 'http://localhost:5173/');
      } catch (err) {
        console.error('[LTI] Fallo el callback:', err);
        res.status(401).send('Token inválido');
      }
    });

    this.router.get('/lti/jwks', (req, res) => {
      // Endpoint de claves públicas (vacío por ahora hasta implementar LTI Advantage completo)
      res.json({ keys: [] });
    });

    // --- Cursos y Tareas (Docentes y Admins) ---
    this.router.get('/courses', authorizeRole(['teacher']), (req, res, next) => this.courseCtrl.getCourses(req, res, next));
    this.router.get('/courses/:courseId/assignments', authorizeRole(['teacher']), (req, res, next) => this.courseCtrl.getAssignments(req, res, next));
    this.router.get('/courses/:courseId/students', authorizeRole(['teacher']), (req, res, next) => this.courseCtrl.getStudents(req, res, next));
    this.router.get('/courses/:courseId/assignments/:assignmentId/submissions/:studentId', authorizeRole(['teacher']), (req, res, next) => this.courseCtrl.getSubmission(req, res, next));
    this.router.post('/courses/:courseId/assignments/:assignmentId/toggle', authorizeRole(['teacher']), (req, res, next) => this.courseCtrl.togglePlugin(req, res, next));

    // --- Plantillas (Solo Docentes y Admins) ---
    this.router.get('/templates', authorizeRole(['teacher']), (req, res, next) => this.templateCtrl.getAll(req, res, next));
    this.router.get('/templates/:id', authorizeRole(['teacher']), (req, res, next) => this.templateCtrl.getOne(req, res, next));
    this.router.post('/templates', authorizeRole(['teacher']), (req, res, next) => this.templateCtrl.create(req, res, next));
    this.router.put('/templates/:id', authorizeRole(['teacher']), (req, res, next) => this.templateCtrl.update(req, res, next));
    this.router.delete('/templates/:id', authorizeRole(['teacher']), (req, res, next) => this.templateCtrl.delete(req, res, next));

    // --- Feedback (Docentes) ---
    this.router.get('/feedback/list', authorizeRole(['teacher']), (req, res, next) => this.feedbackCtrl.listAll(req, res, next));
    this.router.get('/feedback/pending', authorizeRole(['teacher']), (req, res, next) => this.feedbackCtrl.listPending(req, res, next));
    this.router.get('/feedback/detail', authorizeRole(['teacher']), (req, res, next) => this.feedbackCtrl.getDetail(req, res, next));
    this.router.post('/feedback/generate', authorizeRole(['teacher']), (req, res, next) => this.feedbackCtrl.generate(req, res, next));
    this.router.put('/feedback/:id', authorizeRole(['teacher']), (req, res, next) => this.feedbackCtrl.updateFeedback(req, res, next));
    this.router.post('/feedback/approve', authorizeRole(['teacher']), (req, res, next) => this.feedbackCtrl.approveAndSend(req, res, next));
    
    // --- Feedback (Estudiantes) ---
    this.router.get('/student/feedback/:studentId', authorizeRole(['student', 'teacher']), (req, res, next) => this.feedbackCtrl.getStudentView(req, res, next));
    this.router.post('/student/rate', authorizeRole(['student']), (req, res, next) => this.feedbackCtrl.rateByStudent(req, res, next));

    // --- Configuración (Solo Admins) ---
    this.router.put('/config/ia-model', authorizeRole(['admin']), (req, res, next) => this.configCtrl.setIAModel(req, res, next));
    this.router.get('/config/tokens', authorizeRole(['admin']), (req, res, next) => this.configCtrl.getTokens(req, res, next));
    this.router.post('/config/tokens', authorizeRole(['admin']), (req, res, next) => this.configCtrl.saveToken(req, res, next));
    
    // Salud (Público)
    this.router.get('/health', (req, res) => res.json({ status: 'API Operativa', timestamp: new Date() }));
  }

  getRouter() {
    return this.router;
  }
}
