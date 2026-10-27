/**
 * Five sequential, live Gemini diagnostic scenarios for the English Canvas Feedback plugin.
 * Canvas students/submissions, templates and feedback persistence are simulated in memory.
 * Default template text and the configured Gemini provider are read through the app.
 * No template/feedback row is created or changed by this diagnostic.
 * Run from the project's root via ejecutar-con-gemini.sh.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(root, '.env'), quiet: true });
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const loggerFile = path.join(root, 'logs', `gemini-cinco-pruebas-ingles-${runId}.json`);
const reportFile = path.join(root, 'logs', `gemini-cinco-pruebas-ingles-${runId}.md`);
const { default: FeedbackGenerationService } = await import('../../apps/server/src/services/FeedbackGenerationService.js');
const { default: PromptManager } = await import('../../apps/server/src/services/PromptManager.js');
const { default: GradeResolver } = await import('../../apps/server/src/services/variables/GradeResolver.js');
const { default: CourseAverageResolver } = await import('../../apps/server/src/services/variables/CourseAverageResolver.js');
const { default: GeminiProvider } = await import('../../apps/server/src/services/ia/GeminiProvider.js');
const { default: TokenRepository } = await import('../../apps/server/src/data/TokenRepository.js');
const { default: ConfigRepository } = await import('../../apps/server/src/data/ConfigRepository.js');
const { default: IAConfigManager } = await import('../../apps/server/src/services/IAConfigManager.js');
const { default: db } = await import('../../apps/server/src/data/db.js');

// Prevent SDK-level retries in this dedicated opt-in test process: one request per case.
const generateOnce = GeminiProvider.prototype.generateFeedback;
GeminiProvider.prototype.generateFeedback = function (prompt, options = {}) {
  return generateOnce.call(this, prompt, { ...options, singleAttempt: true });
};

const activeConfig = new IAConfigManager(new TokenRepository(), new ConfigRepository());
const cases = [
  { id: 1, slug: 'standard', template: 'Standard Class', student: 'Alex Taylor', score: 94,
    evidence: 'In a technical essay Alex explains service boundaries, API Gateway routing, authentication, rate limiting and failure isolation using Circuit Breakers. Includes specific architecture trade-offs.' },
  { id: 2, slug: 'detailed', template: 'Detailed Feedback', student: 'Jordan Lee', score: 73,
    evidence: 'Jordan explains microservices and service discovery correctly, but the discussion has only one example and does not address observability or operational complexity.' },
  { id: 3, slug: 'peer', template: 'Peer Review', student: 'Taylor Morgan', score: 42,
    evidence: 'Taylor reviews a peer architecture diagram, comments on performance and communication, but supplies no measurable evidence or concrete improvement steps.' },
  { id: 4, slug: 'legacy-with-data', template: 'Standard Class (old variables)', student: 'Casey Rivera', score: 88, average: { mean: 74, pointsPossible: 100 },
    evidence: 'Casey analyzes Circuit Breaker Closed, Open and Half-Open states and provides a recovery example for a failing service.' },
  { id: 5, slug: 'legacy-without-data', template: 'Standard Class (old variables; none available)', student: 'Morgan Brooks', score: null,
    evidence: 'Morgan explains the difference between monolithic systems and microservices and describes an example of independent deployment.' }
];
const selectedId = process.argv.find(x => /^--only=[1-5]$/.test(x))?.split('=')[1];
const selectedCases = selectedId ? cases.filter(c => String(c.id) === selectedId) : cases;
const result = { startedAt: new Date().toISOString(), branch: 'english-version',
  operation: 'FIVE_SYNTHETIC_GEMINI_CALLS', persistedFeedbacks: 0,
  caveats: [
    'Cases 1–4 run the standard graded FeedbackGenerationService with in-memory Canvas, templates and feedback persistence.',
    'Case 5 first tests optional-variable omission on a legacy template, then runs the existing ungraded qualitative service. That ungraded service does not currently select a teacher template.',
    'The course average in case 4 is an explicitly synthetic course-wide statistic, not an assignment mean.',
    'These diagnostics do not create Canvas students, assignments or grade records. No feedback draft is written to PostgreSQL.'
  ], cases: [] };
const recordsByCase = new Map();
const scrub = value => String(value ?? '')
  .replace(/([?&]key=)[^&\s]+/gi, '$1[REDACTED]')
  .replace(/AIza[A-Za-z0-9_-]{20,}/g, '[REDACTED_KEY]')
  .replace(/(Bearer\s+)[^\s]+/gi, '$1[REDACTED]');
const safeText = value => scrub(value).replaceAll('```', "'''");

function writeReport() {
  fs.mkdirSync(path.dirname(loggerFile), { recursive: true });
  fs.writeFileSync(loggerFile, JSON.stringify(result, null, 2) + '\n', { mode: 0o600 });
  const lines = [
    '# Cinco pruebas sintéticas de plantillas — rama inglesa',
    '', `Fecha: ${result.startedAt}`, '',
    'Las entregas, calificaciones, promedios y borradores son simulados en memoria. Gemini sí recibe peticiones reales usando la configuración almacenada del plugin.',
    '', '| # | Caso | Nota | Rango | Estado |', '|---|---|---|---|---|',
    ...result.cases.map(c => `| ${c.id} | ${c.template} | ${c.score === null ? 'Ausente' : c.score + '/100'} | ${c.range ?? 'Sin nota'} | ${c.status} |`),
    '', '## Alcance y limitaciones', ...result.caveats.map(v => `- ${v}`), ''
  ];
  for (const c of result.cases) {
    lines.push(`## ${c.id}. ${c.template}`, '',
      `Estado: ${c.status}`, `Estudiante sintético: ${c.student}`, `Nota: ${c.score ?? 'No disponible'}`,
      `Rango: ${c.range ?? 'No corresponde'}`, `Persistencia de feedback: ${c.persisted ? 'ERROR' : 'ninguna'}`, '');
    if (c.status === 'PASS') {
      lines.push('### Prompt resuelto', '', '```text', safeText(c.prompt), '```',
        '', '### Respuesta exacta de Gemini', '', safeText(c.feedback), '');
    } else {
      lines.push('Error:', '', '```text', safeText(c.error), '```', '');
    }
    if (c.legacyAfterMissingValues) {
      lines.push('### Plantilla legacy después de omitir variables ausentes', '', '```text',
        safeText(c.legacyAfterMissingValues), '```', '');
    }
    if (c.warning) lines.push('Observación:', '', c.warning, '');
  }
  fs.writeFileSync(reportFile, lines.join('\n'), { mode: 0o600 });
}

// Query is read-only; it accesses factory templates without modifying professor-owned rows.
const templateRows = await db.query(
  'SELECT id, nombre, contenido FROM Plantilla_Feedback WHERE profesor_id IS NULL AND deleted_at IS NULL'
);
const templateMap = new Map(templateRows.rows.map(row => [row.nombre, row]));
for (const name of ['Standard Class', 'Detailed Feedback', 'Peer Review']) {
  if (!templateMap.has(name)) throw new Error(`The stored English factory template is missing: ${name}`);
}
const clone = value => JSON.parse(JSON.stringify(value));
const withOptionalVariables = (original) => {
  const body = JSON.parse(original.contenido);
  for (const range of ['alto', 'medio', 'bajo']) {
    const text = body[range];
    if (typeof text !== 'string') throw new Error('Invalid range: ' + range);
    const added = 'Your grade is {{grade}}.\nThe course average is {{course_average}}.\n\n';
    const closing = /(Best regards,|Regards,)\n/i;
    body[range] = closing.test(text) ? text.replace(closing, added + '$1\n') : (text + '\n\n' + added);
  }
  return { ...clone(original), id: 900005, contenido: JSON.stringify(body), nombre: 'Synthetic Standard with optional variables' };
};
const legacyTemplate = withOptionalVariables(templateMap.get('Standard Class'));
const profiles = { getStudentAcademicProfile: async () => ({ history: [] }) };
const validator = { generateStudentProfile: () => ({ level: 'not measured', trend: 'stable', average: null }) };
const mockTeacher = 'english-synthetic-teacher';

for (const item of selectedCases) {
  const out = { id: item.id, case: item.slug, template: item.template, student: item.student,
    score: item.score, status: 'RUNNING', persisted: false, source: 'synthetic-memory' };
  result.cases.push(out);
  writeReport();
  console.log(`\n[${item.id}/5] ${item.template} — starting one Gemini request`);
  try {
    const template = item.id < 4 ? templateMap.get(item.template) : legacyTemplate;
    const assignmentId = 950000 + item.id;
    const studentId = 940000 + item.id;
    const submission = { score: item.score, entered_score: item.score,
      points_possible: 100, submitted_at: '2026-10-26T17:00:00Z',
      workflow_state: item.score === null ? 'submitted' : 'graded',
      submission_type: 'online_text_entry', missing: false, body: item.evidence,
      attachments: [] };
    const assignment = { id: assignmentId, points_possible: 100,
      name: 'Synthetic graded architecture essay',
      description: 'Explain an architecture concept with sound evidence. Provide strengths and concrete improvements.' };
    const gateway = {
      getSubmission: async () => clone(submission),
      getStudents: async () => [{ id: studentId, name: item.student }],
      getQuizQuestions: async () => [],
      getRubric: async () => [],
      getAssignment: async () => clone(assignment),
      getCourseAverage: async () => item.average ? clone(item.average) : null
    };
    const repository = {
      findByStudent: async () => [],
      save: async payload => {
        if (recordsByCase.has(item.id)) throw new Error('Duplicate in-memory feedback');
        const local = { id: `RAM-${item.id}`, contenido_generado: payload.contenidoGenerado,
          prompt_usado: payload.promptUsado, nota_canvas: payload.notaCanvas,
          aprobado: payload.aprobado };
        recordsByCase.set(item.id, local);
        return local;
      },
      updateGeneratedFeedback: async () => { throw new Error('No existing feedback expected in memory'); }
    };
    const templRepo = { getById: async id => Number(id) === Number(template.id) ? clone(template) : null };
    const service = new FeedbackGenerationService(gateway, repository, templRepo,
      profiles, validator, null, activeConfig);
    service.courseVariablesService = { getCourseVariables: async () => ({}) };

    if (item.id === 5) {
      const ranges = JSON.parse(legacyTemplate.contenido);
      const input = ranges.medio;
      const omitted = await PromptManager.buildPrompt(input,
        { student: { name: item.student }, submission: { score: null, pointsPossible: 100 } },
        [new GradeResolver(), new CourseAverageResolver()]);
      if (omitted.includes('{{grade}}') || omitted.includes('{{course_average}}') ||
          /Your grade is\s*\.|The course average is\s*\./.test(omitted) ||
          !omitted.includes('{{student_name}}')) {
        throw new Error('Optional variables were not omitted safely from legacy template');
      }
      out.optionalVariableCheck = 'PASS';
      out.legacyAfterMissingValues = omitted;
      out.warning = 'The normal ungraded branch does not currently apply a selected teacher template. The legacy template was checked separately for correct variable omission.';
    }
    const response = await service.generateFeedback(
      1, assignmentId, studentId, template.id, null, mockTeacher,
      { studentName: item.student, assignmentName: assignment.name,
        courseName: 'Synthetic Software Engineering', isRegenerate: false }
    );
    if (!response?.exito) throw new Error('The main generation service did not return success');
    const saved = recordsByCase.get(item.id);
    if (!saved) throw new Error('No in-memory result was saved');
    if (saved.contenido_generado.includes('[LOCAL MODE') || saved.contenido_generado.length < 100) {
      throw new Error('Model returned a fallback or insufficient answer');
    }
    if (saved.contenido_generado !== response.data.content) throw new Error('Different response and memory output');

    if (item.id < 5) {
      const expectedRange = item.score >= 86 ? 'alto' : (item.score >= 60 ? 'medio' : 'bajo');
      const rangeText = JSON.parse(template.contenido)[expectedRange];
      const nameResolved = rangeText.replaceAll('{{student_name}}', item.student);
      if (!saved.prompt_usado.includes(nameResolved.split('\n')[0])) {
        throw new Error('The template for the expected range was not selected');
      }
      out.range = expectedRange;
      if (item.id === 4) {
        if (!saved.prompt_usado.includes('88 out of 100 points') ||
            !saved.prompt_usado.includes('74 out of 100 points') ||
            saved.prompt_usado.includes('{{grade}}') || saved.prompt_usado.includes('{{course_average}}')) {
          throw new Error('Dynamic variables did not resolve in the normal graded flow');
        }
        out.variableGrade = '88 out of 100 points';
        out.variableCourseAverage = '74 out of 100 points (synthetic course-wide value)';
      } else {
        const expectedText = rangeText.replaceAll('{{student_name}}', item.student);
        if (!saved.prompt_usado.includes(expectedText.slice(0, Math.min(40, expectedText.length)))) {
          throw new Error('Selected teacher template not present in model prompt');
        }
      }
    }
    if (item.id === 5 && saved.nota_canvas !== null) throw new Error('Ungraded case saved a score');
    out.status = 'PASS';
    out.prompt = saved.prompt_usado;
    out.feedback = saved.contenido_generado;
    if (item.id < 5) {
      out.syntheticSubmissionIncludedInPrompt = saved.prompt_usado.includes(item.evidence);
      if (!out.syntheticSubmissionIncludedInPrompt) {
        out.warning = 'The current graded-generation flow did not include the submission body in the model prompt. The model evaluated the teacher template and score instructions, not the full essay evidence.';
      }
    }
    out.feedbackCharacters = saved.contenido_generado.length;
    out.persisted = false;
    console.log(`[${item.id}/5] PASS — ${out.feedbackCharacters} characters; data only in memory`);
  } catch (error) {
    out.status = 'FAILED';
    out.error = scrub((error?.code || error?.name || 'ERROR') + ': ' + String(error?.message || 'Unknown failure'));
    console.error(`[${item.id}/5] FAILED — ${out.error}`);
  } finally { writeReport(); }
}
result.finishedAt = new Date().toISOString();
result.passed = result.cases.filter(c => c.status === 'PASS').length;
result.failed = result.cases.length - result.passed;
writeReport();
console.log(`\nFinished: ${result.passed}/${selectedCases.length} passed. Report: ${reportFile}`);
console.log(`Data: ${loggerFile}`);
await db.pool?.end();
if (result.failed) process.exitCode = 1;
