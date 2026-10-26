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
