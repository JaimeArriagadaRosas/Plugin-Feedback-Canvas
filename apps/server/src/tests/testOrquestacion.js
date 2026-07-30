import test from 'node:test';
import assert from 'node:assert/strict';

import FeedbackService from '../services/FeedbackService.js';
import FeedbackRepository from '../data/FeedbackRepository.js';
import TemplateRepository from '../data/TemplateRepository.js';
import StudentRepository from '../data/StudentRepository.js';
import AcademicHistoryService from '../services/AcademicHistoryService.js';
import ValidadorAcademico from '../services/ValidadorAcademico.js';
import GradeConverter from '../services/calificaciones/GradeConverter.js';

// Mock de GeminiProvider para evitar llamadas reales a la API en tests
class MockGeminiProvider {
  constructor(apiKey) {}
  async generateFeedback(prompt) {
    return "Feedback simulado exitosamente para el estudiante.";
  }
}

class MockCanvasService {
  async getSubmission() { return { score: 90 }; }
  async getQuizQuestions() { return []; }
  async getRubric() { return []; }
  async getStudents() { return [{id: 1, name: 'Estudiante'}]; }
  async getAssignment() { return { id: 101, name: 'Tarea' }; }
}

test('Orquestación de Feedback y GradeConverter', async (t) => {
  // 1. Setup global para los tests de FeedbackService
  const iaProvider = new MockGeminiProvider('mock-key');
  const canvasService = new MockCanvasService();
  const feedbackRepo = new FeedbackRepository({});
  const templateRepo = new TemplateRepository({});
  const studentRepo = new StudentRepository({});
  const academicService = new AcademicHistoryService(canvasService, studentRepo);

  const orquestador = new FeedbackService(
    iaProvider, canvasService, feedbackRepo, templateRepo,
    academicService, ValidadorAcademico
  );

  await t.test('GradeConverter: Convierte notas base 100 a escala de Chile (1.0 - 7.0)', () => {
    const gc1 = GradeConverter.toChileGrade(90, 100);
    assert.strictEqual(gc1.chileGrade, 6.3, '90/100 debería ser un 6.3');
    assert.strictEqual(gc1.approved, true, '90/100 debería estar aprobado');

    const gc2 = GradeConverter.toChileGrade(50, 100);
    assert.strictEqual(gc2.chileGrade, 3.4, '50/100 debería ser un 3.4');
    assert.strictEqual(gc2.approved, false, '50/100 debería estar reprobado');

    const gc3 = GradeConverter.toChileGrade(60, 100);
    assert.strictEqual(gc3.chileGrade, 4.0, '60/100 debería ser un 4.0');
    assert.strictEqual(gc3.approved, true, '60/100 debería estar aprobado justo en el umbral');
  });

  await t.test('FeedbackService: Genera feedback exitoso para un estudiante con nota sobresaliente (9.0/10)', async () => {
    const result = await orquestador.generateFeedback(14852, 101, 1, 1, 9.0);
    
    assert.strictEqual(result.exito, true, 'El resultado debe indicar éxito');
    assert.ok(result.data, 'Debe devolver datos en result.data');
    
    const { canvasScore, chileGrade, approved, profile } = result.data;
    assert.strictEqual(canvasScore, 90, 'La nota en escala 100 debe ser 90');
    assert.strictEqual(chileGrade, 6.3, 'La nota en escala chilena debe ser 6.3');
    assert.strictEqual(approved, true, 'El estudiante debe estar aprobado');
    assert.ok(profile, 'Debe existir un perfil académico');
  });

  await t.test('FeedbackService: Genera feedback reprobado para un estudiante con nota deficiente (4.0/10)', async () => {
    const result = await orquestador.generateFeedback(14852, 101, 3, 1, 4.0);
    
    assert.strictEqual(result.exito, true, 'El resultado debe indicar éxito');
    assert.ok(result.data, 'Debe devolver datos en result.data');
    
    const { canvasScore, chileGrade, approved } = result.data;
    assert.strictEqual(canvasScore, 40, 'La nota en escala 100 debe ser 40');
    assert.strictEqual(chileGrade, 2.9, 'La nota en escala chilena debe ser 2.9');
    assert.strictEqual(approved, false, 'El estudiante debe estar reprobado');
  });
});
