import FeedbackService from './src/services/FeedbackService.js';
import CanvasServiceLocal from './src/services/infrastructure/CanvasService_local.js';

async function main() {
  try {
    const s = new CanvasServiceLocal('t','u');
    console.log('=== Test Canvas Local ===');

    const courses = await s.getCourses();
    console.log('Cursos:', JSON.stringify(courses[0]));

    const assignments = await s.getAssignments(14852);
    console.log('Asignaciones:', JSON.stringify(assignments.map(a => ({id:a.id, name:a.name}))));

    const qq = await s.getQuizQuestions(14852, 101);
    console.log('Preguntas:', qq.length, 'isArray:', Array.isArray(qq));
    if (qq.length > 0) console.log('Pregunta 1:', JSON.stringify(qq[0]));

    const sub = await s.getSubmission(14852, 101, 1);
    console.log('Entrega keys:', Object.keys(sub));
    console.log('questions field is Array:', Array.isArray(sub.questions));

    const ga = typeof s.getAssignment;
    console.log('getAssignment existe:', typeof ga);
    const gaRes = await s.getAssignment(14852, 101);
    console.log('getAssignment nombre:', gaRes.name);

  } catch(e) {
    console.error('FALLO:', e.message);
    console.error(e.stack.split('\n').slice(0, 5).join('\n'));
  }
}
main();
