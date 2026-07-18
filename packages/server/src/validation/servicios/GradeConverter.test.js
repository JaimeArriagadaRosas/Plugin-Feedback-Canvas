import { describe, it, expect } from 'vitest';
import GradeConverter from '../../services/calificaciones/GradeConverter.js';

describe('GradeConverter  Caja Negra', () => {
  describe('toChileGrade', () => {
    it('convierte nota aprobatoria (90/100) a nota chilena ~6.9', () => {
      const result = GradeConverter.toChileGrade(90, 100);
      expect(result.chileGrade).toBeCloseTo(6.3, 1);
      expect(result.approved).toBe(true);
    });

    it('convierte nota reprobatoria (50/100) a nota chilena ~3.4', () => {
      const result = GradeConverter.toChileGrade(50, 100);
      expect(result.chileGrade).toBeCloseTo(3.4, 1);
      expect(result.approved).toBe(false);
    });

    it('maneja el umbral exacto de aprobacin (60/100)  4.0', () => {
      const result = GradeConverter.toChileGrade(60, 100);
      expect(result.chileGrade).toBe(4.0);
      expect(result.approved).toBe(true);
    });

    it('clampa nota mnima a 1.0', () => {
      const result = GradeConverter.toChileGrade(0, 100);
      expect(result.chileGrade).toBe(1.0);
    });

    it('clampa nota mxima a 7.0', () => {
      const result = GradeConverter.toChileGrade(100, 100);
      expect(result.chileGrade).toBe(7.0);
    });

    it('normaliza correctamente exmenes que no son de 100 pts', () => {
      const result = GradeConverter.toChileGrade(30, 50);
      expect(result.chileGrade).toBeCloseTo(4.0, 1);
      expect(result.approved).toBe(true);
    });
  });

  describe('getToneForChileGrade', () => {
    it('retorna tono motivador para nota >= 5.5', () => {
      expect(GradeConverter.getToneForChileGrade(6.0)).toBe('motivador y de excelencia');
    });

    it('retorna tono constructivo para nota 4.05.4', () => {
      expect(GradeConverter.getToneForChileGrade(4.5)).toBe('constructivo y estándar');
    });

    it('retorna tono de apoyo para nota < 4.0', () => {
      expect(GradeConverter.getToneForChileGrade(3.5)).toBe('de apoyo y refuerzo');
    });
  });

  describe('getToneForCanvasScore', () => {
    it('retorna tono motivador para score >= 70', () => {
      expect(GradeConverter.getToneForCanvasScore(80)).toBe('motivador y de excelencia');
    });

    it('retorna tono constructivo para score 6069', () => {
      expect(GradeConverter.getToneForCanvasScore(65)).toBe('constructivo y estándar');
    });

    it('retorna tono de apoyo para score < 60', () => {
      expect(GradeConverter.getToneForCanvasScore(50)).toBe('de apoyo y refuerzo');
    });
  });
});
