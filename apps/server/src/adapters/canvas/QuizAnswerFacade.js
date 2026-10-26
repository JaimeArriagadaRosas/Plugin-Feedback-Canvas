import { parseString } from '@fast-csv/parse';
import { DomainError } from '../../utils/errors.js';

const parseCsv = (content) => new Promise((resolve, reject) => {
  const rows = [];
  parseString(content, { headers: columns => columns.map((header,index) => `${String(header || '').trim() || 'column'}__${index}`), ignoreEmpty: true })
    .on('error', reject).on('data', row => rows.push(row)).on('end', () => resolve(rows));
});

export default class QuizAnswerFacade {
  constructor(adapter) { this.adapter = adapter; }

  async getQuizAnswers(courseId, assignmentId, studentId, teacherId) {
    const quizzes = await this.adapter._fetchAllWithToken('/courses/' + courseId + '/quizzes', teacherId);
    const quiz = quizzes.find(q => String(q.assignment_id) === String(assignmentId));
    if (!quiz) throw new DomainError('Canvas quiz was not found', 422, 'QUIZ_NOT_FOUND');

    const response = await this.adapter._fetchWithToken('/courses/' + courseId + '/quizzes/' + quiz.id + '/submissions', teacherId);
    const attempts = response.quiz_submissions || [];
    const selected = attempts.filter(a => String(a.user_id) === String(studentId) && ['complete', 'pending_review'].includes(a.workflow_state))
      .sort((a, b) => Number(b.attempt || 0) - Number(a.attempt || 0))[0];
    if (!selected) throw new DomainError('No completed quiz attempt is available', 422, 'QUIZ_ATTEMPT_MISSING');

    const details = await this.adapter._fetchWithToken('/quiz_submissions/' + selected.id + '/questions', teacherId);
    const questions = details.quiz_submission_questions || [];
    const direct = questions.filter(q => Object.hasOwn(q, 'answer') && q.answer != null && String(q.answer).trim())
      .map(q => ({question_id:q.id, question_text:String(q.question_text || q.question_name || ''), answer:String(q.answer)}));
    if (direct.length) return direct;

    const report = await this.adapter._fetchWithToken('/courses/' + courseId + '/quizzes/' + quiz.id + '/reports?includes_all_versions=true', teacherId);
    const analysis = (Array.isArray(report) ? report : []).filter(r => r.report_type === 'student_analysis' && r.file?.id).sort((a,b)=>Number(b.id||0)-Number(a.id||0))[0];
    if (!analysis?.file?.id) throw new DomainError('Student Analysis report is not generated. Create it in Canvas and retry.', 422, 'QUIZ_REPORT_PENDING');

    const { buffer } = await this.adapter.downloadSubmissionAttachment({id:analysis.file.id,filename:analysis.file.filename}, teacherId);
    const rows = await parseCsv(buffer.toString('utf8'));
    const match = rows.find(row => String(Object.entries(row).find(([key]) => key === 'id__0' || /^id__\d+$/.test(key))?.[1]) === String(studentId));
    if (!match) throw new DomainError('Student Analysis report does not contain the student', 422, 'QUIZ_STUDENT_NOT_IN_REPORT');
    const reportedAt = Date.parse(String(Object.entries(match).find(([key]) => /^submitted__\d+$/.test(key))?.[1] || '').replace(' UTC', 'Z').replace(' ', 'T'));
    const attemptAt = Date.parse(selected.finished_at || '');
    if (!Number.isFinite(reportedAt) || !Number.isFinite(attemptAt) || Math.abs(reportedAt - attemptAt) > 60000)
      throw new DomainError('Student Analysis report is stale for this attempt; regenerate it in Canvas', 422, 'QUIZ_REPORT_STALE');
    const answerEntries = Object.entries(match).filter(([key, value]) => /^\d+:\s/.test(key) && String(value ?? '').trim());
    const answers = answerEntries.map(([key, value]) => ({
      question_id:Number(key.split(':')[0]),
      question_text:key.replace(/^\d+:\s*/,'').replace(/__\d+$/,''),
      answer:String(value).trim()
    }));
    if (!answers.length) throw new DomainError('Canvas does not provide verifiable answers for this attempt', 422, 'QUIZ_ANSWERS_UNAVAILABLE');
    return answers;
  }
}
