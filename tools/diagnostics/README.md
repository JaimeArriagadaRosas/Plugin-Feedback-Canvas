# English API integration diagnostics

These scripts operate on the isolated, locally seeded English Canvas environment. Start the English branch with `npm start` (mode 3), ensure the Canvas HTTPS proxy listens on 8443, and configure Gemini in the application. No API key or Canvas token should appear in logs or commits.

- `feedback-e2e.mjs --mode=preflight --course=1 --assignment=2 --student=6`: verify Canvas identity, fetch the attachment and analyze supported content; **no Gemini call or feedback write**.
- `feedback-e2e.mjs --mode=generate --confirm=ONE_REQUEST --course=... --assignment=... --student=...`: **one real Gemini call**, pending draft only, never Canvas publication. Use fresh submissions and do not duplicate successful test records.
- `feedback-e2e.mjs --mode=quiz-readonly --course=1 --assignment=1 --student=7`: reads Classic Quiz answers without changing grades. A missing or failed Student Analysis report blocks the check.
- `verify-english-feedback-records.mjs`: read-only database verification of the three completed English pending drafts.
- `inventory-english-submissions.rb` and `audit-quiz-start-times.rb`: read-only Canvas Rails inspections via `bundle exec rails runner -` in the local Canvas web container.
- `verify-english-fixtures.rb`: isolated creation of English PPTX files for two students, verifying slide language and distinct SHA-256 hashes; uses `/tmp/unique_submission_file_english.rb` and `/tmp/english_master.pptx` in the local Canvas web container.
- `repair-local-quiz-start-times.rb`: **one-time mutation of strictly verified synthetic test fixtures**; requires `CONFIRM_SYNTHETIC_QUIZ_TIME_FIX=YES`. Repairs only missing `started_at`, preserving grade and answer data.
- `request-quiz-student-analysis.mjs`: read-only report query by default. `--progress` checks the report's async progress; `--create-report` explicitly requests a new report, so do not run it without intention to write to the local test Canvas.

The complete run, findings and known limitations are documented in `docs/ENGLISH_E2E_RESULTS_20261025.md`.
