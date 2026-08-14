import test from 'node:test';
import assert from 'node:assert/strict';

import FeedbackService from '../services/FeedbackService.js';
import FeedbackRepository from '../data/FeedbackRepository.js';
import TemplateRepository from '../data/TemplateRepository.js';
import StudentRepository from '../data/StudentRepository.js';
import AcademicHistoryService from '../services/AcademicHistoryService.js';
import ValidadorAcademico from '../services/ValidadorAcademico.js';
import GradeConverter from '../services/calificaciones/GradeConverter.js';

// Mock of GeminiProvider to avoid real API calls in tests
class MockGeminiProvider {
  constructor(apiKey) {}
  async generateFeedback(prompt) {
    return "Feedback successfully simulated for the student.";
  }
}

class MockCanvasService {
  async getSubmission() { return { score: 90 }; }
  async getQuizQuestions() { return []; }
  async getRubric() { return []; }
  async getStudents() { return [{id: 1, name: 'Student'}]; }
  async getAssignment() { return { id: 101, name: 'Assignment' }; }
}

test('Feedback Orchestration and GradeConverter', async (t) => {
  // 1. Global setup for FeedbackService tests
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

  await t.test('GradeConverter: Converts base 100 grades to Chile scale (1.0 - 7.0)', () => {
    const gc1 = GradeConverter.toChileGrade(90, 100);
    assert.strictEqual(gc1.chileGrade, 6.3, '90/100 should be 6.3');
    assert.strictEqual(gc1.approved, true, '90/100 should be approved');

    const gc2 = GradeConverter.toChileGrade(50, 100);
    assert.strictEqual(gc2.chileGrade, 3.4, '50/100 should be 3.4');
    assert.strictEqual(gc2.approved, false, '50/100 should be failed');

    const gc3 = GradeConverter.toChileGrade(60, 100);
    assert.strictEqual(gc3.chileGrade, 4.0, '60/100 should be 4.0');
    assert.strictEqual(gc3.approved, true, '60/100 should be approved right on the threshold');
  });

  await t.test('FeedbackService: Generates successful feedback for a student with outstanding grade (9.0/10)', async () => {
    const result = await orquestador.generateFeedback(14852, 101, 1, 1, 9.0);
    
    assert.strictEqual(result.exito, true, 'The result must indicate success');
    assert.ok(result.data, 'It must return data in result.data');
    
    const { canvasScore, chileGrade, approved, profile } = result.data;
    assert.strictEqual(canvasScore, 90, 'The grade on 100 scale must be 90');
    assert.strictEqual(chileGrade, 6.3, 'The grade on Chilean scale must be 6.3');
    assert.strictEqual(approved, true, 'The student must be approved');
    assert.ok(profile, 'An academic profile must exist');
  });

  await t.test('FeedbackService: Generates failed feedback for a student with poor grade (4.0/10)', async () => {
    const result = await orquestador.generateFeedback(14852, 101, 3, 1, 4.0);
    
    assert.strictEqual(result.exito, true, 'The result must indicate success');
    assert.ok(result.data, 'It must return data in result.data');
    
    const { canvasScore, chileGrade, approved } = result.data;
    assert.strictEqual(canvasScore, 40, 'The grade on 100 scale must be 40');
    assert.strictEqual(chileGrade, 2.9, 'The grade on Chilean scale must be 2.9');
    assert.strictEqual(approved, false, 'The student must be failed');
  });
});
