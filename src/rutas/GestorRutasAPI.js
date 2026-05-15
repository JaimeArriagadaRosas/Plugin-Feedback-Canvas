import express from 'express';
import CourseController from '../controlador/CourseController.js';
import TemplateController from '../controlador/TemplateController.js';
import FeedbackController from '../controlador/FeedbackController.js';
import ConfigController from '../controlador/ConfigController.js';
import { authorizeRole } from '../middlewares/AuthLTI13Handler.js';

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
    this.configCtrl = new ConfigController(this.deps.iaConfigManager);
  }

  configurarRutas() {
    // --- Rutas LTI 1.3 ---
    this.router.post('/lti/launch', (req, res) => res.json({ message: 'Launch OK' }));

    // --- Cursos y Tareas (Docentes y Admins) ---
    this.router.get('/courses', authorizeRole(['teacher']), (req, res, next) => this.courseCtrl.getCourses(req, res, next));
    this.router.get('/courses/:courseId/assignments', authorizeRole(['teacher']), (req, res, next) => this.courseCtrl.getAssignments(req, res, next));
    this.router.post('/assignments/:assignmentId/toggle', authorizeRole(['teacher']), (req, res, next) => this.courseCtrl.togglePlugin(req, res, next));

    // --- Plantillas (Solo Docentes y Admins) ---
    this.router.get('/templates', authorizeRole(['teacher']), (req, res, next) => this.templateCtrl.getAll(req, res, next));
    this.router.get('/templates/:id', authorizeRole(['teacher']), (req, res, next) => this.templateCtrl.getOne(req, res, next));
    this.router.post('/templates', authorizeRole(['teacher']), (req, res, next) => this.templateCtrl.create(req, res, next));
    this.router.put('/templates/:id', authorizeRole(['teacher']), (req, res, next) => this.templateCtrl.update(req, res, next));
    this.router.delete('/templates/:id', authorizeRole(['teacher']), (req, res, next) => this.templateCtrl.delete(req, res, next));

    // --- Feedback (Docentes) ---
    this.router.get('/feedback/pending', authorizeRole(['teacher']), (req, res, next) => this.feedbackCtrl.listPending(req, res, next));
    this.router.get('/feedback/detail', authorizeRole(['teacher']), (req, res, next) => this.feedbackCtrl.getDetail(req, res, next));
    this.router.post('/feedback/generate', authorizeRole(['teacher']), (req, res, next) => this.feedbackCtrl.generate(req, res, next));
    this.router.put('/feedback/:id', authorizeRole(['teacher']), (req, res, next) => this.feedbackCtrl.updateFeedback(req, res, next));
    this.router.post('/feedback/approve', authorizeRole(['teacher']), (req, res, next) => this.feedbackCtrl.approveAndSend(req, res, next));
    
    // --- Feedback (Estudiantes) ---
    this.router.get('/student/feedback/:studentId', authorizeRole(['student', 'teacher']), (req, res, next) => this.feedbackCtrl.getStudentView(req, res, next));

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
