import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

import { corsMiddleware } from '../../src/security/cors.js';
import { createPrivateNotesRoutes } from '../../src/routes/api/private_notes.routes.js';
import CanvasWebhookController from '../../src/controllers/CanvasWebhookController.js';
import FeedbackWorkflowService from '../../src/services/FeedbackWorkflowService.js';
import FeedbackMutationService from '../../src/services/FeedbackMutationService.js';
import FeedbackQueryService from '../../src/services/FeedbackQueryService.js';
import StudentRole from '../../src/modules/permissions/roles/StudentRole.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Regresiones de la auditoría', () => {
  it('permite healthchecks sin Origin aunque el entorno sea productivo', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      const app = express();
      app.use(corsMiddleware());
      app.get('/health', (_req, res) => res.json({ ok: true }));
      app.use((error, _req, res, _next) => res.status(500).json({ error: error.message }));

      const response = await request(app).get('/health');
      const blocked = await request(app).get('/health').set('Origin', 'https://evil.example');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ok: true });
      expect(blocked.status).toBe(500);
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });

  it('ejecuta la ruta de nota privada y rechaza IDs inválidos sin colgarse', async () => {
    const privateNoteCtrl = {
      updateNote: vi.fn((_req, res) => res.json({ exito: true }))
    };
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.appIdentity = {
        roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor']
      };
      next();
    });
    app.use('/private-notes', createPrivateNotesRoutes(privateNoteCtrl));
    app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ error: error.message }));

    const valid = await request(app).put('/private-notes/1').send({ nota_privada: 'Seguimiento' });
    const invalid = await request(app).put('/private-notes/no-es-id').send({ nota_privada: 'Seguimiento' });

    expect(valid.status).toBe(200);
    expect(privateNoteCtrl.updateNote).toHaveBeenCalledTimes(1);
    expect(invalid.status).toBe(400);
  });

  it('incluye nota privada, valoración y nota cero en el DTO de revisión', async () => {
    const service = new FeedbackQueryService(
      {
        listAll: vi.fn().mockResolvedValue([{
          id: 7,
          estudiante_id: '11',
          profesor_id: '22',
          curso_id: '33',
          tarea_id: '44',
          nota_chile: 0,
          contenido_generado: 'Contenido',
          calificacion_profesor: 4,
          nota_privada: 'Privada',
          estado: 'EDITADO'
        }])
      },
      {},
      {},
      {}
    );

    const [feedback] = await service.getListAll(null, 'system');
    expect(feedback.grade).toBe(0);
    expect(feedback.rating).toBe(4);
    expect(feedback.nota_privada).toBe('Privada');
  });

  it('activa view_feedback para estudiantes por defecto', () => {
    expect(new StudentRole().getDefaults().view_feedback).toBe(true);
  });

  it('extrae un identificador de webhook y marca el evento procesado', async () => {
    const feedbackService = { generateFeedback: vi.fn().mockResolvedValue({ exito: true }) };
    const configRepo = { getConfigAsignacion: vi.fn().mockResolvedValue({ profesor_id: 'teacher-1', plantilla_id: 2 }) };
    const webhookService = {
      claimEvent: vi.fn().mockResolvedValue({ claimed: true, attempts: 1, status: 'PROCESSING' }),
      markProcessed: vi.fn().mockResolvedValue(),
      markFailed: vi.fn(),
      moverADeadLetter: vi.fn()
    };
    const controller = new CanvasWebhookController(feedbackService, configRepo, webhookService);
    controller.validarFirmaWebhook = vi.fn().mockReturnValue(true);

    const req = {
      headers: { 'x-canvas-event-name': 'grade_change', 'x-canvas-event-id': 'event-123' },
      body: { course_id: 1, assignment_id: 2, user_id: 3, score: 90 }
    };
    const response = { statusCode: 200 };
    response.status = vi.fn(code => { response.statusCode = code; return response; });
    response.json = vi.fn(body => body);
    const next = vi.fn();

    const extracted = controller._extractEventData(req);
    await controller.handleWebhook(req, response, next);

    expect(extracted.eventId).toBe('event-123');
    expect(extracted.eventHash).toMatch(/^[a-f0-9]{64}$/);
    expect(response.status).toHaveBeenCalledWith(202);
    expect(webhookService.markProcessed).toHaveBeenCalledWith(extracted.eventHash);
    expect(webhookService.markFailed).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('registra el fallo de webhook para permitir reintento', async () => {
    const feedbackService = { generateFeedback: vi.fn().mockRejectedValue(new Error('Canvas no disponible')) };
    const configRepo = { getConfigAsignacion: vi.fn().mockResolvedValue({ profesor_id: 'teacher-1' }) };
    const webhookService = {
      claimEvent: vi.fn().mockResolvedValue({ claimed: true, attempts: 1, status: 'PROCESSING' }),
      markProcessed: vi.fn(),
      markFailed: vi.fn().mockResolvedValue({ attempts: 1, status: 'FAILED', deadLetter: false }),
      moverADeadLetter: vi.fn()
    };
    const controller = new CanvasWebhookController(feedbackService, configRepo, webhookService);
    controller.validarFirmaWebhook = vi.fn().mockReturnValue(true);
    const req = {
      headers: { 'x-canvas-event-name': 'grade_change' },
      body: { event_id: 'event-456', course_id: 1, assignment_id: 2, user_id: 3, score: 90 }
    };
    const response = { status: vi.fn(() => response), json: vi.fn() };
    const next = vi.fn();

    await controller.handleWebhook(req, response, next);

    expect(webhookService.markFailed).toHaveBeenCalledTimes(1);
    expect(webhookService.markProcessed).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 500 }));
  });

  it('incluye feedbacks EDITADO en el lote y limita el lote al profesor', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{
          id: 1,
          estado: 'EDITADO',
          profesor_id: 'teacher-1',
          contenido_generado: 'Editado'
        }] })
        .mockResolvedValueOnce({ rows: [] })
    };
    const feedbackRepo = {
      executeTransaction: vi.fn(callback => callback(client))
    };
    const service = new FeedbackWorkflowService(feedbackRepo, {}, {}, {}, {});
    service._processCanvasUploadsInBackground = vi.fn().mockResolvedValue();

    const result = await service.bulkApproveAndSend([1], 'teacher-1');
    const [selectSql, selectParams] = client.query.mock.calls[0];

    expect(selectSql).toContain("estado IN ('PENDIENTE', 'EDITADO')");
    expect(selectSql).toContain('profesor_id');
    expect(selectParams).toEqual([1, 'teacher-1']);
    expect(result.count).toBe(1);
    expect(service._processCanvasUploadsInBackground).toHaveBeenCalledTimes(1);
  });

  it('permite que una sola aprobación concurrente publique en Canvas', async () => {
    const existing = {
      id: 1,
      estado: 'EDITADO',
      estudiante_id: '3',
      curso_id: '1',
      tarea_id: '2',
      profesor_id: 'teacher-1',
      contenido_generado: 'Contenido'
    };
    const feedbackRepo = {
      getById: vi.fn().mockResolvedValue(existing),
      claimForApproval: vi.fn()
        .mockResolvedValueOnce({ ...existing, estado: 'APROBADO' })
        .mockResolvedValueOnce(null),
      updateProfesorRating: vi.fn(),
      updateStatusAndContent: vi.fn().mockResolvedValue({}),
      saveNotification: vi.fn()
    };
    const canvasGateway = {
      postComment: vi.fn().mockResolvedValue(),
      updateGrade: vi.fn(),
      pushInAppMessage: vi.fn()
    };
    const service = new FeedbackMutationService(
      feedbackRepo,
      canvasGateway,
      { getStudentPreference: vi.fn().mockResolvedValue({ metodo: 'none' }) },
      null,
      null
    );
    const command = {
      feedbackId: 1,
      courseId: 1,
      assignmentId: 2,
      studentId: 3,
      content: 'Contenido'
    };

    const results = await Promise.allSettled([
      service.approveAndSend(command, null, 'teacher-1'),
      service.approveAndSend(command, null, 'teacher-1')
    ]);

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect(canvasGateway.postComment).toHaveBeenCalledTimes(1);
    expect(feedbackRepo.updateStatusAndContent).toHaveBeenCalledWith(1, 'ENVIADO', 'Contenido');
  });

  it('resuelve el nombre manual desde Canvas y conserva una nota cero', async () => {
    const feedbackRepo = {
      save: vi.fn().mockResolvedValue({ id: 9 }),
      updateStatusAndContent: vi.fn().mockResolvedValue({})
    };
    const canvasGateway = {
      getStudents: vi.fn().mockResolvedValue([{ id: 3, name: 'Ada Lovelace' }])
    };
    const service = new FeedbackMutationService(feedbackRepo, canvasGateway, null, null, null);

    await service.submitManualFeedback({
      courseId: 1,
      assignmentId: 2,
      studentId: 3,
      teacherId: 'teacher-1',
      contenidoManual: 'Buen trabajo',
      grade: 0
    });

    expect(feedbackRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      nombreEstudiante: 'Ada Lovelace',
      notaCanvas: 0
    }));
  });

  it('registra email fallido cuando producción no tiene proveedor configurado', async () => {
    const existing = {
      id: 1,
      estado: 'EDITADO',
      estudiante_id: '3',
      curso_id: '1',
      tarea_id: '2',
      profesor_id: 'teacher-1',
      contenido_generado: 'Contenido'
    };
    const feedbackRepo = {
      getById: vi.fn().mockResolvedValue(existing),
      claimForApproval: vi.fn().mockResolvedValue({ ...existing, estado: 'APROBADO' }),
      updateProfesorRating: vi.fn(),
      updateStatusAndContent: vi.fn().mockResolvedValue({}),
      saveNotification: vi.fn().mockResolvedValue({})
    };
    const service = new FeedbackMutationService(
      feedbackRepo,
      { postComment: vi.fn().mockResolvedValue() },
      { getStudentPreference: vi.fn().mockResolvedValue({ metodo: 'email' }) },
      null,
      null
    );

    const result = await service.approveAndSend({
      feedbackId: 1,
      courseId: 1,
      assignmentId: 2,
      studentId: 3,
      content: 'Contenido'
    }, null, 'teacher-1');

    expect(result.warnings).toContain('NOTIFICATION_FAILED');
    expect(feedbackRepo.saveNotification).toHaveBeenCalledWith(
      '3',
      1,
      expect.any(String),
      'error_email'
    );
  });
});
