import logger from '../../utils/logger.js';

export default class SubmissionFacade {
  constructor(adapter) {
    this.adapter = adapter;
  }

  async getSubmission(courseId, assignmentId, studentId, teacherId) {
    return this.adapter._fetchWithToken(`/courses/${courseId}/assignments/${assignmentId}/submissions/${studentId}?include[]=submission_history&include[]=submission_comments`, teacherId);
  }

  async getStudentSubmissions(courseId, studentId, teacherId) {
    return this.adapter._fetchAllWithToken(`/courses/${courseId}/students/submissions?student_ids[]=${studentId}&include[]=assignment`, teacherId);
  }

  async getAssignmentSubmissions(courseId, assignmentId, teacherId) {
    return this.adapter._fetchAllWithToken(`/courses/${courseId}/assignments/${assignmentId}/submissions`, teacherId);
  }

  async getStudentGrades(courseId, studentId, teacherId) {
    return this.adapter._fetchWithToken(`/courses/${courseId}/users/${studentId}/enrollments`, teacherId);
  }

  async postComment(courseId, assignmentId, studentId, teacherId, comment) {
    // Previous GET verification (Idempotency required by directive 2)
    const current = await this.getSubmission(courseId, assignmentId, studentId, teacherId);
    const alreadyExists = current?.submission_comments?.some(c => c.comment === comment);
    if (alreadyExists) {
      logger.info(`[CanvasLmsAdapter] Idempotency: Comment already exists for ${studentId}, skipping PUT.`);
      return current;
    }
    return this.adapter._fetchWithToken(`/courses/${courseId}/assignments/${assignmentId}/submissions/${studentId}`, teacherId, {
      method: 'PUT',
      body: JSON.stringify({ comment: { text_comment: comment } })
    });
  }

  async updateGrade(courseId, assignmentId, studentId, teacherId, grade) {
    // Previous GET verification (Idempotency required by directive 2)
    const current = await this.getSubmission(courseId, assignmentId, studentId, teacherId);
    if (current && String(current.grade) === String(grade)) {
      logger.info(`[CanvasLmsAdapter] Idempotency: Grade already assigned for ${studentId}, skipping PUT.`);
      return current;
    }
    return this.adapter._fetchWithToken(`/courses/${courseId}/assignments/${assignmentId}/submissions/${studentId}`, teacherId, {
      method: 'PUT',
      body: JSON.stringify({ submission: { posted_grade: grade } })
    });
  }

  async pushRubricAssessment(courseId, assignmentId, studentId, teacherId, rubricAssessment) {
    logger.info(`[CanvasLmsAdapter] Pushing rubric for student ${studentId} in assignment ${assignmentId}`);
    
    // Previous GET verification (Idempotency required by directive 2)
    const current = await this.adapter._fetchWithToken(`/courses/${courseId}/assignments/${assignmentId}/submissions/${studentId}?include[]=rubric_assessment`, teacherId);
    if (current && current.rubric_assessment) {
      const isSame = JSON.stringify(current.rubric_assessment) === JSON.stringify(rubricAssessment);
      if (isSame) {
        logger.info(`[CanvasLmsAdapter] Idempotency: Rubric already assigned for ${studentId}, skipping PUT.`);
        return current;
      }
    }
    return this.adapter._fetchWithToken(`/courses/${courseId}/assignments/${assignmentId}/submissions/${studentId}`, teacherId, {
      method: 'PUT',
      body: JSON.stringify({ rubric_assessment: rubricAssessment })
    });
  }
}
