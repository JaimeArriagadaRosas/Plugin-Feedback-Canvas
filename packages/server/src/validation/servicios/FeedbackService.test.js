import { describe, it, expect, vi, beforeEach } from 'vitest';
import FeedbackService from '../../services/FeedbackService.js';
import GradeConverter from '../../services/calificaciones/GradeConverter.js';
import { DomainError } from '../../domain/errors/DomainError.js';

const mockCanvasService = () => ({
  getSubmission: vi.fn(async () => ({
    body: 'Entrega',
    score: 90,
    submitted_at: '2026-05-14T10:00:00Z',
    points_possible: 100,
    questions: [],
    correct_count: 9,
    incorrect_count: 1,
    accuracy_percent: 90
  })),
  getQuizQuestions: vi.fn(async () => []),
  getRubric: vi.fn(async () => []),
  getStudents: vi.fn(async () => [{ id: 1, name: 'Juan Prez' }]),
  getAssignment: vi.fn(async () => ({ name: 'Examen Parcial' })),
  getAssignments: vi.fn(async () => [])
});

const mockTemplateRepo = () => ({
  getById: vi.fn(async () => ({
    id: 1,
    nombre: 'Plantilla Estndar',
    contenido: 'Estimado/a {{STUDENT_NAME}}, tu nota es {{CHILE_GRADE}}.'
  }))
});

const mockAcademicHistory = () => ({
  getStudentAcademicProfile: vi.fn(async () => ({
    level: 'PROMEDIO',
    trend: 'Estable',
    average: 7.0
  }))
});

const mockFeedbackRepo = () => ({
  save: vi.fn(async (data) => ({ id: 1, ...data }))
});

const mockConfigRepo = () => ({
  getConfigAsignacion: vi.fn(async () => null)
});

describe('FeedbackService  Caja Negra', () => {
  let canvasService, templateRepo, feedbackRepo, configRepo;

  beforeEach(() => {
    canvasService = mockCanvasService();
    templateRepo = mockTemplateRepo();
    feedbackRepo = mockFeedbackRepo();
    configRepo = mockConfigRepo();
  });

  it('orquesta generacin completa y retorna exito=true', async () => {
    const service = new FeedbackService(
      { generateFeedback: vi.fn(async () => 'Feedback generado') },
      canvasService,
      feedbackRepo,
      templateRepo,
      mockAcademicHistory(),
      { generateStudentProfile: (h) => h },
      configRepo
    );

    const result = await service.generateFeedback(14852, 101, 1, 1, 90.0);
    expect(result.exito).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.chileGrade).toBeGreaterThanOrEqual(4.0);
    expect(result.data.canvasScore).toBe(90);
  });

  it('lanza DomainError cuando la plantilla no existe', async () => {
    templateRepo.getById.mockResolvedValueOnce(null);

    const service = new FeedbackService(
      { generateFeedback: vi.fn(async () => 'Feedback') },
      canvasService,
      feedbackRepo,
      templateRepo,
      mockAcademicHistory(),
      { generateStudentProfile: (h) => h },
      configRepo
    );

      await expect(service.generateFeedback(14852, 101, 1, 999, 90.0)).rejects.toThrow(DomainError);
    });
  
    it('propaga errores de servicios externos', async () => {
      canvasService.getSubmission.mockRejectedValueOnce(new Error('Canvas no disponible'));
  
      const service = new FeedbackService(
        { generateFeedback: vi.fn(async () => 'Feedback') },
        canvasService,
        feedbackRepo,
        templateRepo,
        mockAcademicHistory(),
        { generateStudentProfile: (h) => h },
        configRepo
      );
  
      await expect(service.generateFeedback(14852, 101, 1, 1, 90.0)).rejects.toThrow('Canvas no disponible');
  });
});
