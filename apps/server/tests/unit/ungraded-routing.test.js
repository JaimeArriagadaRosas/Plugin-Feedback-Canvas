import { describe, it, expect, vi } from 'vitest';
import FeedbackGenerationService from '../../src/services/FeedbackGenerationService.js';
import FeedbackMutationService from '../../src/services/FeedbackMutationService.js';

describe('Selección e integración sin nota', () => {
  const repo = { findByStudent: vi.fn(async () => []) };
  const gateway = {
    getSubmission: vi.fn(async () => ({ id:11, workflow_state:'submitted', body:'Trabajo argumentado', score:null })),
    getQuizQuestions: vi.fn(async () => []),
    getRubric: vi.fn(async () => [{ description:'Argumentación' }]),
    getStudents: vi.fn(async () => [{ id:3, name:'Estudiante' }]),
    getAssignment: vi.fn(async () => ({ id:2,name:'Actividad',description:'Explicar resultado' }))
  };
  it('sin nota deriva al motor cualitativo y no accede a plantillas', async () => {
    const templateRepo = { getById: vi.fn() };
    const history = { getStudentAcademicProfile: vi.fn() };
    const generation = new FeedbackGenerationService(gateway,repo,templateRepo,history,{}, {},{});
    generation.ungraded.generate = vi.fn(async () => ({ exito:true, data:{ mode:'qualitative' }}));
    const result = await generation.generateFeedback(1,2,3,null,undefined,'teacher');
    expect(result.data.mode).toBe('qualitative');
    expect(generation.ungraded.generate).toHaveBeenCalledOnce();
    expect(templateRepo.getById).not.toHaveBeenCalled();
    expect(history.getStudentAcademicProfile).not.toHaveBeenCalled();
  });
  it('publicar comentario cualitativo no modifica nota de Canvas', async () => {
    const api = { postComment:vi.fn(async () => {}), updateGrade:vi.fn(async () => {}) };
    const mutation = new FeedbackMutationService({},api);
    await mutation._publishToCanvas({courseId:1,assignmentId:2,studentId:3,teacherId:'teacher', content:'Revisar evidencia.',grade:null});
    expect(api.postComment).toHaveBeenCalledOnce();
    expect(api.updateGrade).not.toHaveBeenCalled();
  });
  it('la calificación cero válida sí se conserva', async () => {
    const api = { postComment:vi.fn(async () => {}), updateGrade:vi.fn(async () => {}) };
    const mutation = new FeedbackMutationService({},api);
    await mutation._publishToCanvas({courseId:1,assignmentId:2,studentId:3,teacherId:'teacher',content:'Observación',grade:0});
    expect(api.updateGrade).toHaveBeenCalledWith(1,2,3,'teacher',0);
  });
});
