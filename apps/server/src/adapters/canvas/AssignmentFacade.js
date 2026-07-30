export default class AssignmentFacade {
  constructor(adapter) {
    this.adapter = adapter;
  }

  async getAssignments(courseId, teacherId) {
    return this.adapter._fetchAllWithToken(`/courses/${courseId}/assignments?per_page=50`, teacherId);
  }
  
  async getAssignment(courseId, assignmentId, teacherId) {
    return this.adapter._fetchWithToken(`/courses/${courseId}/assignments/${assignmentId}`, teacherId);
  }

  async getRubric(courseId, assignmentId, teacherId) {
    const assignment = await this.getAssignment(courseId, assignmentId, teacherId);
    return assignment.rubric || [];
  }
  
  async getQuizQuestions(courseId, assignmentId, teacherId) {
    const quizzes = await this.adapter._fetchAllWithToken(`/courses/${courseId}/quizzes`, teacherId);
    const quiz = quizzes.find(q => String(q.assignment_id) === String(assignmentId));
    if (!quiz) return [];
    return this.adapter._fetchAllWithToken(`/courses/${courseId}/quizzes/${quiz.id}/questions`, teacherId);
  }
}
