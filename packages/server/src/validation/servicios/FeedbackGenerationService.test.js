import { describe, it, expect } from 'vitest';
import FeedbackGenerationService from '../../services/FeedbackGenerationService.js';
import { DomainError } from '../../domain/errors/DomainError.js';

const buildService = () => new FeedbackGenerationService(
  { generateFeedback: async () => 'ok' },
  {
    getSubmission: async () => ({}),
    getQuizQuestions: async () => [],
    getRubric: async () => ({}),
    getStudents: async () => [],
    getAssignment: async () => ({}),
    getAssignments: async () => []
  },
  { save: async () => ({}) },
  { getById: async () => ({ contenido: '', id: 1 }) },
  { getStudentAcademicProfile: async () => ({}) },
  { generateStudentProfile: async () => ({}) },
  { getConfigAsignacion: async () => null }
);

describe('FeedbackGenerationService._convertGrade', () => {
  it('lanza error si points_possible es 0', () => {
    const service = buildService();
    expect(() => service._convertGrade(70, { points_possible: 0 })).toThrow(DomainError);
  });

  it('lanza error si points_possible es negativo', () => {
    const service = buildService();
    expect(() => service._convertGrade(70, { points_possible: -10 })).toThrow(DomainError);
  });

  it('acepta nota chilena dentro de rango (1.0–7.0)', () => {
    const service = buildService();
    const result = service._convertGrade(5.5, { points_possible: 100 });
    expect(result.chileGrade).toBeCloseTo(5.5, 1);
    expect(result.canvasScore).toBeGreaterThanOrEqual(0);
    expect(result.canvasScore).toBeLessThanOrEqual(100);
  });

  it('lanza error si nota chilena es menor a 1.0', () => {
    const service = buildService();
    expect(() => service._convertGrade(0.5, { points_possible: 100 })).toThrow(DomainError);
  });

  it('acepta nota chilena en el limite superior 7.0', () => {
    const service = buildService();
    const result = service._convertGrade(7.0, { points_possible: 100 });
    expect(result.chileGrade).toBeCloseTo(7.0, 1);
    expect(result.approved).toBe(true);
  });

  it('acepta calificación Canvas dentro de rango (0–100)', () => {
    const service = buildService();
    const result = service._convertGrade(80, { points_possible: 100 });
    expect(result.chileGrade).toBeGreaterThanOrEqual(4.0);
    expect(result.approved).toBe(true);
  });

  it('lanza error si calificación Canvas es negativa', () => {
    const service = buildService();
    expect(() => service._convertGrade(-5, { points_possible: 100 })).toThrow(DomainError);
  });

  it('lanza error si calificación Canvas excede points_possible', () => {
    const service = buildService();
    expect(() => service._convertGrade(150, { points_possible: 100 })).toThrow(DomainError);
  });

  it('lanza error si currentGrade es NaN', () => {
    const service = buildService();
    expect(() => service._convertGrade(NaN, { points_possible: 100 })).toThrow(DomainError);
  });

  it('lanza error si currentGrade es Infinity', () => {
    const service = buildService();
    expect(() => service._convertGrade(Infinity, { points_possible: 100 })).toThrow(DomainError);
  });

  it('lanza error si currentGrade es string no numérico', () => {
    const service = buildService();
    expect(() => service._convertGrade('abc', { points_possible: 100 })).toThrow(DomainError);
  });

  it('acepta calificación Canvas de examen no estándar (30/50)', () => {
    const service = buildService();
    const result = service._convertGrade(30, { points_possible: 50 });
    expect(result.chileGrade).toBeCloseTo(4.0, 1);
    expect(result.approved).toBe(true);
  });

  it('lanza error si calificación Canvas excede points_possible de examen no estándar', () => {
    const service = buildService();
    expect(() => service._convertGrade(60, { points_possible: 50 })).toThrow(DomainError);
  });
});
