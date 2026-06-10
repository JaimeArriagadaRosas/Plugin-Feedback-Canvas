import { AppError } from '../middlewares/ErrorHandler.js';

/**
 * Controlador de Feedback (RF23, RF24, RF25, RF26, RF30, RF31)
 */
export default class FeedbackController {
  constructor(feedbackService, canvasService) {
    this.feedbackService = feedbackService;
    this.canvasService = canvasService;
  }

  async listPending(req, res, next) {
    try {
      const pending = await this.feedbackService.feedbackRepo.getStats();
      res.json({ exito: true, data: pending });
    } catch (error) {
      next(error);
    }
  }

  async listAll(req, res, next) {
    try {
      const list = await this.feedbackService.feedbackRepo.listAll();
      const courseId = list[0]?.curso_id || 14852;
      const students = await this.canvasService.getStudents(courseId);

      const enriched = list.map(fb => {
        const student = students.find(s => s.id === fb.estudiante_id) || { name: `Estudiante ${fb.estudiante_id}` };
        
        // Determinar perfil dinámico en base a ID
        const profiles = ["PROMEDIO", "SOBRESALIENTE", "EN RIESGO"];
        const trends = ["Estable", "Mejorando", "Bajando"];
        const profile = profiles[fb.estudiante_id % 3];
        const trend = trends[fb.estudiante_id % 3];

        return {
          id: fb.id,
          student: student.name,
          studentId: fb.estudiante_id,
          courseId: fb.curso_id,
          assignmentId: fb.tarea_id,
          templateId: fb.plantilla_id,
          grade: "7.0/10", // Fallback de nota
          profile: profile,
          trend: trend,
          status: fb.estado || "PENDIENTE",
          feedback: fb.contenido_generado
        };
      });

      res.json({ exito: true, data: enriched });
    } catch (error) {
      next(error);
    }
  }

  async getDetail(req, res, next) {
    try {
      const { studentId, courseId } = req.query;
      const history = await this.feedbackService.feedbackRepo.findByStudent(studentId, courseId);
      res.json({ exito: true, data: history });
    } catch (error) {
      next(error);
    }
  }

  async generate(req, res, next) {
    try {
      const { courseId, assignmentId, studentId, templateId, grade } = req.body;
      const result = await this.feedbackService.generateFeedback(courseId, assignmentId, studentId, templateId, grade);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async updateFeedback(req, res, next) {
    try {
      const { id } = req.params;
      const { nuevoContenido } = req.body;
      // Actualizar en DB
      await this.feedbackService.feedbackRepo.updateStatusAndContent(id, 'EDITADO', nuevoContenido);
      res.json({ exito: true, mensaje: 'Feedback editado', data: { id, nuevoContenido } });
    } catch (error) {
      next(error);
    }
  }

  async approveAndSend(req, res, next) {
    try {
      const { feedbackId, courseId, assignmentId, studentId, content, rating, grade } = req.body;
      // Actualizar en DB
      if (feedbackId) {
        await this.feedbackService.feedbackRepo.updateStatusAndContent(feedbackId, 'APROBADO', content);
        if (rating) {
           await this.feedbackService.feedbackRepo.updateProfesorRating(feedbackId, rating);
        }
      }
      // Enviar a Canvas
      await this.canvasService.postComment(courseId, assignmentId, studentId, content);
      
      if (grade) {
        await this.canvasService.updateGrade(courseId, assignmentId, studentId, grade);
      }
      
      // Simular Notificación
      if (feedbackId) {
        await this.feedbackService.feedbackRepo.saveNotification(
          studentId, 
          feedbackId, 
          `Tienes un nuevo feedback aprobado en el curso ${courseId}`
        );
      }

      res.json({ exito: true, mensaje: 'Feedback aprobado y enviado a Canvas SpeedGrader. Notificación enviada.' });
    } catch (error) {
      next(error);
    }
  }

  async rateByStudent(req, res, next) {
    try {
      const { feedbackId, rating } = req.body;
      await this.feedbackService.feedbackRepo.updateEstudianteRating(feedbackId, rating);
      res.json({ exito: true, mensaje: 'Calificación guardada' });
    } catch (error) {
      next(error);
    }
  }

  async getStudentView(req, res, next) {
    try {
      const { studentId } = req.params;
      // Get all feedback for this student
      const history = await this.feedbackService.feedbackRepo.findByStudent(studentId, 14852);
      
      // Filter only approved ones
      const approved = history.filter(fb => fb.estado === 'APROBADO' || fb.estado === 'ENVIADO');
      
      const assignments = [
        { id: 101, name: "Control 1: Diagramas de Clase", due: "05/05/2026", score: "6.0", total: "7.0", hasFeedback: false },
        { id: 102, name: "Proyecto Semestral: Fase 1", due: "12/05/2026", score: "5.5", total: "7.0", hasFeedback: false },
        { id: 103, name: "Entrega Final: Prototipo", due: "20/05/2026", score: "-", total: "7.0", hasFeedback: false },
      ];

      // Map approved feedback to assignments
      approved.forEach(fb => {
        const assignment = assignments.find(a => a.id == fb.tarea_id) || assignments[0];
        assignment.hasFeedback = true;
        assignment.feedback = fb;
      });
      
      res.json({ exito: true, data: assignments });
    } catch (error) {
      next(error);
    }
  }
}
