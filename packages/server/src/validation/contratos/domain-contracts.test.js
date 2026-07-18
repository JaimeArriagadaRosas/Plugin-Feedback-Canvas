import { describe, it, expect } from 'vitest';
import { DomainError } from '../../domain/errors/DomainError.js';
import { IFeedbackRepository } from '../../domain/ports/IFeedbackRepository.js';
import { ICanvasService } from '../../domain/ports/ICanvasService.js';

describe('DomainError  Error de negocio', () => {
  it('extiende AppError con statusCode 422 por defecto', () => {
    const error = new DomainError('Regla de negocio violada');
    expect(error).toBeInstanceOf(Error);
    expect(error.statusCode).toBe(422);
    expect(error.name).toBe('DomainError');
    expect(error.isOperational).toBe(true);
    // 422 es un error 4xx  'fail' (cliente), no 'error' (servidor)
    expect(error.status).toBe('fail');
  });

  it('acepta statusCode personalizado', () => {
    const notFound = new DomainError('Recurso no encontrado', 404);
    expect(notFound.statusCode).toBe(404);
    expect(notFound.status).toBe('fail');
  });
});

describe('IFeedbackRepository  Contrato del repositorio', () => {
  it('define la firma de los mtodos esperados', () => {
    const methods = [
      'save', 'findByStudent', 'getStats', 'listAll',
      'getById', 'updateStatusAndContent', 'updateProfesorRating',
      'updateEstudianteRating', 'saveNotification'
    ];
    methods.forEach(method => {
      expect(typeof IFeedbackRepository.prototype[method]).toBe('function');
    });
  });
});

describe('ICanvasService  Contrato del servicio Canvas', () => {
  it('define la firma de los mtodos esperados', () => {
    const methods = [
      'getCourses', 'getStudents', 'getCourse', 'getAssignments',
      'getAssignment', 'getRubric', 'getSubmission', 'getStudentGrades',
      'postComment', 'updateGrade'
    ];
    methods.forEach(method => {
      expect(typeof ICanvasService.prototype[method]).toBe('function');
    });
  });
});
