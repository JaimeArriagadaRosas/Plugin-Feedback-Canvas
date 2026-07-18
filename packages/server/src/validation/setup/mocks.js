const { vi } = await import('vitest');

export const mockGeminiProvider = () => ({
  generateFeedback: vi.fn(async () => 'Feedback generado por mock de Gemini.')
});

export const mockCanvasService = () => ({
  getCourses: vi.fn(async () => [
    { id: 14852, name: 'Ingeniera de Software II', course_code: 'ISW2-2026' }
  ]),
  getAssignments: vi.fn(async (courseId) => {
    if (courseId === 14852) {
      return [{ id: 101, name: 'Examen Parcial', points_possible: 100 }];
    }
    return [];
  }),
  getStudents: vi.fn(async (courseId) => {
    if (courseId === 14852) {
      return [{ id: 1, name: 'Juan Prez' }, { id: 2, name: 'Mara Garca' }];
    }
    return [];
  }),
  getSubmission: vi.fn(async (courseId, assignmentId, studentId) => ({
    body: 'Entrega de prueba',
    score: 90,
    submitted_at: '2026-05-14T10:00:00Z',
    points_possible: 100,
    questions: [
      { id: 'q1', text: 'Pregunta 1', options: { A: 'a', B: 'b' }, correct_answer: 'B', student_answer: 'B', is_correct: true },
      { id: 'q2', text: 'Pregunta 2', options: { A: 'a', B: 'b' }, correct_answer: 'A', student_answer: 'A', is_correct: true }
    ],
    correct_count: 2,
    incorrect_count: 0,
    accuracy_percent: 100
  })),
  getQuizQuestions: vi.fn(async () => []),
  getRubric: vi.fn(async () => []),
  postComment: vi.fn(async () => ({ success: true })),
  updateGrade: vi.fn(async () => ({ success: true })),
  getAssignment: vi.fn(async () => ({ name: 'Examen Parcial', points_possible: 100 }))
});

export const mockAcademicHistory = () => ({
  getStudentAcademicProfile: vi.fn(async () => ({
    level: 'PROMEDIO',
    trend: 'Estable',
    average: 7.0,
    grades: [{ grade: 8.0, date: '2026-05-01' }]
  }))
});
