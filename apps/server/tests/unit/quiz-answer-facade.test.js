import { describe, it, expect } from 'vitest';
import QuizAnswerFacade from '../../src/adapters/canvas/QuizAnswerFacade.js';

function fixture(questions) {
  return new QuizAnswerFacade({
    _fetchAllWithToken: async () => [{id:6,assignment_id:16}],
    _fetchWithToken: async (endpoint) => endpoint.includes('/questions')
      ? {quiz_submission_questions:questions}
      : {quiz_submissions:[{id:25,user_id:7,workflow_state:'pending_review',attempt:1}]}
  });
}
describe('QuizAnswerFacade', () => {
  it('recovers the actual student answer through Canvas API', async () => {
    const answers = await fixture([{id:21,question_text:'Explica API Gateway',answer:'Enruta y autentica peticiones'}])
      .getQuizAnswers(1,16,7,'teacher');
    expect(answers).toEqual([{question_id:21,question_text:'Explica API Gateway',answer:'Enruta y autentica peticiones'}]);
  });
  it('blocks when Canvas only exposes the questions', async () => {
    await expect(fixture([{id:21,question_text:'Explica API Gateway'}])
      .getQuizAnswers(1,16,7,'teacher')).rejects.toMatchObject({errorCode:'QUIZ_REPORT_PENDING'});
  });
});
