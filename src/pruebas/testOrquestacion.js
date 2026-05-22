import FeedbackService from '../servicios/FeedbackService.js';
import GeminiProvider from '../servicios/ia/GeminiProvider.js';
import CanvasServiceMock from '../servicios/CanvasService.mock.js';
import FeedbackRepository from '../datos/FeedbackRepository.js';
import TemplateRepository from '../datos/TemplateRepository.js';
import StudentRepository from '../datos/StudentRepository.js';
import AcademicHistoryService from '../servicios/AcademicHistoryService.js';
import ValidadorAcademico from '../servicios/ValidadorAcademico.js';
import GradeConverter   from '../servicios/calificaciones/GradeConverter.js';

async function testFlow() {
  console.log('--- TEST DE ORQUESTACIÓN DE FEEDBACK ---');

  // 1. Setup
  const iaProvider      = new GeminiProvider('mock-api-key');
  const canvasService   = new CanvasServiceMock('token', 'https://canvas.instructure.com');
  const feedbackRepo    = new FeedbackRepository({});
  const templateRepo    = new TemplateRepository({});
  const studentRepo     = new StudentRepository({});
  const academicService = new AcademicHistoryService(canvasService, studentRepo);

  const orquestador = new FeedbackService(
    iaProvider, canvasService, feedbackRepo, templateRepo,
    academicService, ValidadorAcademico
  );

  // 2. Casos de prueba (nota en escala 0–10: 9 correctas → 9.0, etc.)
  const testCases = [
    { id: 1, grade: 9.0 },   // Juan Pérez   → 9/10 correctas → 90/100 → Chile 6.9 ✓
    { id: 2, grade: 5.0 },   // María García → 5/10 correctas → 50/100 → Chile 3.4 ✗
    { id: 3, grade: 4.0 },   // Pedro López  → 4/10 correctas → 40/100 → Chile 2.9 ✗
    { id: 4, grade: 8.0 },   // Ana Torres   → 8/10 correctas → 80/100 → Chile 5.9 ✓
  ];

  for (const tc of testCases) {
    const label = [,'Juan Pérez','María García','Pedro López','Ana Torres'][tc.id] || `Estudiante ${tc.id}`;
    console.log(`\n═══ ${label} (nota enviada: ${tc.grade}/10) ═══`);

    try {
      const result = await orquestador.generateFeedback(
        14852,          // ISWII
        101,            // Examen Parcial Arquitectura (10 preguntas × 10 pts)
        tc.id,
        1,
        tc.grade        // ← nota 0–10 desde el SpeedGrader
      );

      if (result.exito && result.data) {
        const { canvasScore, chileGrade, approved, questionsDetail, profile } = result.data;
        const notaStr = `${canvasScore}/100 → ${chileGrade}/7.0 (${approved ? 'aprobado ✓' : 'reprobado ✗'})`;
        console.log(`  Nota:         ${notaStr}`);
        console.log(`  Perfil:       ${profile.level} | tendencia ${profile.trend} | promedio ${profile.average}`);
        console.log(`  Aciertos:     ${questionsDetail?.match(/✅/g)?.length   || 'N/A'} correctas`);
        console.log(`  Errores:      ${questionsDetail?.match(/❌/g)?.length   || 'N/A'} incorrectas`);
        console.log(`  Contiene IDs: ${questionsDetail?.includes('[q') ? 'SÍ' : 'NO'}`);
      }
    } catch (error) {
      console.error(`  FALLO: ${error.message}`);
    }
  }

  // 3. Test independiente de GradeConverter
  console.log('\n--- TEST GradeConverter ---');
  const gc = GradeConverter.toChileGrade(90, 100);   // 6.9
  const gc2 = GradeConverter.toChileGrade(50, 100);  // 3.4
  const gc3 = GradeConverter.toChileGrade(60, 100);  // 4.0 (umbral exacto)
  console.log(`  90/100 → Chile: ${gc.chileGrade}/7.0 (aprobado=${gc.approved})`);
  console.log(`  50/100 → Chile: ${gc2.chileGrade}/7.0 (aprobado=${gc2.approved})`);
  console.log(`  60/100 → Chile: ${gc3.chileGrade}/7.0 (aprobado=${gc3.approved})`);

  console.log('\n✅ Todos los tests completados.');
}

testFlow().catch(e => { console.error(e); process.exit(1); });
