import { DomainError } from '../../utils/errors.js';

export default class QuizAnswerFacade {
  constructor(adapter) { this.adapter = adapter; }

  async getQuizAnswers(courseId, assignmentId, studentId, teacherId) {
    const quizzes = await this.adapter._fetchAllWithToken('/courses/' + courseId + '/quizzes', teacherId);
    const quiz = quizzes.find(q => String(q.assignment_id) === String(assignmentId));
    if (!quiz) throw new DomainError('No se encontró el cuestionario de Canvas', 422, 'QUIZ_NOT_FOUND');
    const results = await this.adapter._fetchWithToken('/courses/' + courseId + '/quizzes/' + quiz.id + '/submissions', teacherId);
    const attempts = results.quiz_submissions || [];
    const matches = attempts.filter(a => String(a.user_id) === String(studentId) && ['complete','pending_review'].includes(a.workflow_state));
    const selected = matches.sort((a,b) => Number(b.attempt || 0) - Number(a.attempt || 0))[0];
    if (!selected) throw new DomainError('No hay un intento de cuestionario completado', 422, 'QUIZ_ATTEMPT_MISSING');
    const details = await this.adapter._fetchWithToken('/quiz_submissions/' + selected.id + '/questions', teacherId);
    const questions = details.quiz_submission_questions || [];
    const answers = questions.filter(q => Object.hasOwn(q, 'answer') && q.answer != null &&
      String(q.answer).trim().length > 0)
      .map(q => ({question_id:q.id, question_text:String(q.question_text || q.question_name || ''),answer:q.answer}));
    if (!answers.length) throw new DomainError('Canvas no expone respuestas verificables de este intento', 422, 'QUIZ_ANSWERS_UNAVAILABLE');
    return answers;
  }
}
