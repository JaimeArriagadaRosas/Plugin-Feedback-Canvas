# English E2E results — 2026-10-25

Branch: `feat/english-qualitative-feedback-parity`. Local Canvas active through Docker, using an authorized teacher token per course and the English Gemini `gemini-3.6-flash` configuration. The HTTPS 8443 Canvas proxy was started separately for authenticated downloads. No changes to `english-version` or `main`.

## Real Gemini tests (single request per unique positive case)

| ID | Scenario | Canvas course / assignment / student | Feedback draft | Output language | Result |
|---|---|---|---|---|---|
| 1 | PPTX, ungraded | 1 / 2 / 6 (John Smith) | 1, 2,257 characters | English | PASS |
| 2 | Text submission, ungraded | 1 / 3 / 7 (Mary Johnson) | 2, 1,780 characters | English | PASS |
| 3 | PDF, ungraded | 3 / 8 / 10 (Charles Davis) | 3, 1,427 characters | English | PASS |

The recipient in each response matched the Canvas student, as observed in the actual output. The AI reviewed the extracted submission content rather than invented grades or scores. Each result was saved as a pending draft. Database verification `verify-english-feedback-records.mjs` passed 3/3: one draft per scenario, recipient correct, `estado=PENDIENTE`, `nota_canvas=null`, `nota_chile=null`, `aprobado=null`. Canvas Rails read-only inspection confirms the underlying three submissions retain null score and grade. There was no feedback publication in these tests.

## Negative tests (zero Gemini calls)

| Scenario | Canvas course / assignment / student | Result |
|---|---|---|
| XLSX | 2 / 5 / 9 (Anna Brown) | Expected HTTP 422 rejection; unsupported format |
| ZIP | 5 / 14 / 7 (Mary Johnson) | Expected HTTP 422 rejection; unsupported format |

The preflight path processed these submissions and rejected the attachment before any AI request. No feedback was created for these cases.

## Incidents and corrections

1. The initial E2E script inherited a hardcoded Spanish teacher account. It now chooses the local teacher with authorized enrollment per course, with no tokens printed.
2. Authenticated attachment downloads initially failed because the TLS proxy at port 8443 was not running. A dedicated proxy was started; the PPTX and PDF preflights succeeded.
3. Existing English Canvas PPTX fixtures still contained Spanish slide copy from the Spanish source master, although student labels and generated feedback were English. The English `UniqueSubmissionFile` generator now replaces each slide's template text with English content before adding per-student/assignment identifiers. Isolated Rails generation for John Smith and Anna Brown passed: readable ZIP package, English-only slide text, distinct SHA-256 hashes. Existing Canvas attachments were left unchanged.
4. Classic Quiz initially returned **HTTP 500** at `/courses/1/quizzes/1/submissions`. Canvas development logs revealed `TypeError: can't convert NilClass into an exact number` in `Quizzes::QuizSubmission#time_spent`, caused by missing `started_at` in all **20 synthetic Classic Quiz submissions**. The English seeder now sets `started_at` before `finished_at`. A guarded, local-only Rails repair updated *only* this missing timestamp for 20 existing synthetic records, checking that scores, kept scores, submission data and finish times were unchanged. The quiz submissions API then responded correctly. A Student Analysis report was requested via Canvas API (HTTP 200, report ID 1), but its background progress ended in `failed` (Canvas internal error). The facade now reports `QUIZ_REPORT_PENDING` instead of an HTTP 500. All existing Classic Quiz submissions are graded, so the complete ungraded quiz-to-Gemini flow still requires a new controlled fixture and a working report. **Status: BLOCKED, not passed**.
5. No Google Gemini 503 occurred in these successful real requests. Such responses remain a documented external provider risk.

## Repeat commands

From the English feature worktree, after running `npm start` in mode 3 and ensuring `https://localhost:8443` is up:

```bash
node tools/diagnostics/feedback-e2e.mjs --mode=preflight --course=1 --assignment=2 --student=6
node tools/diagnostics/feedback-e2e.mjs --mode=preflight --course=2 --assignment=5 --student=9
node tools/diagnostics/feedback-e2e.mjs --mode=quiz-readonly --course=1 --assignment=1 --student=7
node tools/diagnostics/verify-english-feedback-records.mjs
```

Actual generation requires `--mode=generate --confirm=ONE_REQUEST`. **Do not rerun already generated cases solely to test the integration**; existing pending drafts must remain unique. Use fresh test submissions for future API calls.

## Acceptance boundary

Real API calls passed for PPTX, PDF, and text; negative conversion tests passed for ZIP and XLSX; persisted drafts and Canvas grades were independently checked. Classic Quiz and New Quizzes/group behavior are **not fully validated**. Existing PPTX fixtures remain Spanish until a new isolated seed run, though future English seed output is corrected. Do not merge the English feature branch until remaining user-acceptance tests are reviewed.

## Follow-up — Classic Quiz diagnostics and English string audit

- Diagnostic evidence from the Canvas background worker exposed the Student Analysis failure: `Quizzes::QuizStatistics::StudentAnalysis#to_csv` calls `submission.quiz_data.detect`, but the synthetic quiz attempts were created with `quiz_data=nil`. All 20 test attempts were affected. The English seeder has been changed to set `quiz_data: quiz.quiz_data` for **future** synthetic attempts; it also sets a valid `started_at` before `finished_at`.
- A local metadata-only repair of the 20 synthetic `quiz_data` fields allowed one Student Analysis request to complete at 100%. However, the direct repair wrote an incorrectly encoded YAML value, causing Canvas API HTTP 500. **This bad change was rolled back by restoring `quiz_data` to its original nil state in all 20 local attempts**, without changing scores or answers. This means existing fixture question snapshots remain incomplete: do not treat a completed report job as end-to-end acceptance. The proper durable repair should seed fresh, Rails-serialized quiz attempts, not use direct update_columns for serialized attributes.
- A new isolated regression test covers Canvas Student Analysis CSVs with duplicate score headers (e.g., `25.0` repeated); the English adapter preserves per-column identity and strips synthetic suffixes from question descriptions. It passes with the existing quiz facade tests.
- `tools/diagnostics/audit-english-strings.mjs` found **0 candidate Spanish strings** in the selected English feedback, Canvas adapter, installer-orchestration and seeder source directories. This is a targeted scan, not a complete UI localization certification.
- Real Gemini E2E results for PPTX, PDF and text remain 3/3 passing and their drafts remain pending/ungraded. Existing XLSX/ZIP negative cases remain approved.
- Classic Quiz **remains blocked for full E2E** pending creation of a clean, ungraded quiz submission with valid Rails-managed snapshots and successful answer extraction. Never alter existing students' grades to force a positive test.

## Continuation — 2026-10-26

- Preserved all outstanding changes on `feat/english-qualitative-feedback-parity`; did not merge or modify `english-version` or `main`.
- Fixed quiz Student Analysis regression test after the Canvas endpoint gained `?includes_all_versions=true`. All three focused quiz tests passed (2 files).
- Replaced computed response-property lookups with `Object.entries` and fixed six CI lint errors: document XML scan, quiz access, and `FeedbackGenerationService` method length. Full ESLint run passed.
- Existing local Docker containers did not include Canvas web/API; real ungraded Classic Quiz E2E cannot be accepted without that service. No Gemini request or database mutation was made for the blocked quiz.
- Do not publish or merge the English branch until the clean local Classic Quiz fixture yields a verifiable student-answer row and a real qualitative draft with null grades, followed by full validation.
