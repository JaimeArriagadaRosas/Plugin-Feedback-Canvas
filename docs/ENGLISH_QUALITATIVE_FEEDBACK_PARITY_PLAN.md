# English parity plan — qualitative feedback without grades

## Branch boundaries
- Baseline: `english-version` at `3726700`.
- Isolated feature branch: `feat/english-qualitative-feedback-parity`.
- Reference implementation: Spanish `main` at `0290c3c` (read-only comparison).
- NEVER merge `main` into `english-version` or into this branch. NEVER rebase this feature branch onto `main`.
- Preserve English UI copy, Canvas seed identities, documentation, installer prompts, and API-facing messages.

## Required behavioral parity (implement after review)
1. Generate qualitative feedback for submitted assignments with no grade. Distinguish absent/null score from valid zero and review-pending essay quizzes.
2. Extract genuine submission evidence: authenticated PDF, PPTX, DOCX, plaintext and Canvas quiz answer reports; preserve errors for unsupported, inaccessible, empty and oversized files before calling an LLM.
3. Include optional rubric/instructions, never invent scores, keep the result as a draft without posting to Canvas, and avoid overriding existing approved/sent feedback.
4. Default the Gemini model to `gemini-3.6-flash` while retaining configurable provider settings; document transient 503 (service overloaded/unavailable), with controlled retries only outside single-attempt E2E.
5. Use Canvas `display_name` before deduplicated `filename`; derive recipient identity from Canvas rather than the filename or document contents; do not assume group-membership support from names in the file.
6. Update the local Canvas seeder so generated PDF, PPTX, XLSX and ZIP content is distinct per student and assignment, preserving each native file type.
7. Port quiz-answer retrieval with Student Analysis CSV fallback and evidence freshness checks. Do not treat Classic Quizzes as automatically equivalent to New Quizzes.
8. Preserve secure startup and port-ownership controls: inspect PID and project location, prompt before terminating anything, reuse compatible local services, only close processes started by tests.
9. Include database migrations for nullable grade and feedback templates, reviewed against the English branch's existing schema, never copy production rows between branches.

## Implementation stages
- Phase A: Audit English architecture and map Spanish commits by responsibility (adapters, services, persistence, installer, seeder, client). Port logically, not by wholesale file copy or cross-language merge.
- Phase B: Implement domain contracts and repository schema, submission processors, identity context, Gemini provider and quiz paths. Keep all strings English.
- Phase C: Integrate English UI and admin settings, update seed fixtures, startup behavior, and write native English documentation.
- Phase D: Run unit, regression, installer, client and build suites; add only missing behavioral tests; run isolated Canvas/Rails fixture generation with rollback.
- Phase E: Run one-request-at-a-time manual E2E on a freshly initialized English Canvas, verify feedback remains draft-only, verify no grade change, and verify branch cleanliness.

## Regression acceptance
- Unit tests: null vs zero grade, no-submission, unreadable attachment, rubric optional, deduplicated filename vs display name, recipient context, quiz real answer availability, persistence without a grade, and process ownership.
- Fixture tests: unique SHA-256 for two different student/assignment combinations across PDF/PPTX/XLSX/ZIP, with parseable formats.
- E2E: file/text/quiz drafts, graceful 422 on ZIP/XLSX, no LLM call on rejected files, no Canvas publication, no grade mutation, and safe cleanup.
- Documentation: English architecture and test evidence with commands, scope, known 503, limitations on New Quizzes, existing stale reports, and group submissions.

## Merge procedure when parity work is complete
1. Commit and review on `feat/english-qualitative-feedback-parity`; no cross-language merges.
2. Run all suites, ensure the working tree is clean, and obtain explicit approval for the English integration.
3. From the English worktree, switch to `english-version` (after releasing other worktrees that may have checked it out); run `git merge --ff-only feat/english-qualitative-feedback-parity` when possible. If English progressed meanwhile, update/reconcile from `english-version` only.
4. Verify the expected English HEAD and test outcomes, push `english-version` if authorized, and delete the feature branch only after verifying commits are preserved.
5. Switching branches merely changes the checked-out code. It does NOT integrate commits. Never use `git merge main` for parity.

## Operational status
- The Spanish merge into local `main` succeeded at `0290c3c`, but remote push must be confirmed separately.
- Option 5 was launched on Spanish `main` and container removal began. At documentation time, Docker reports Canvas web container stuck in `removing`; English environment cleanup/switch has not yet been confirmed complete.
- This file is a proposal only. No Spanish functionality has yet been ported into this branch.
