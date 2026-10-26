# Neutral Canvas score and template defaults — English development

Date: 2026-10-26. Scope: `english-version` only. Spanish `main` must not be changed during this work.

## Findings and prior Spanish parity gap
- English default seeded templates (`Standard Class`, `Detailed Feedback`, `Peer Review`) embedded `{{grade}}`; English new-template editor embedded `{{grade}}` and `{{course_average}}`, with misleading preview examples 3.5 and 5.2.
- Spanish code already removed grade mentions in seeded templates, but the Spanish new-template editor still includes `{{promedio_curso}}`. Preview examples still contain 3.5 and 5.2. The Chilean conversion remains in both branches.
- English `GradeConverter`, `TemplateManager` and `FeedbackGenerationService` used Chilean grades. The revised English path uses Canvas raw scores and the percentage only for range selection, with 60% and 86% thresholds. Legacy Chilean utility remains for compatibility but must not be invoked in the principal feedback flow.
- `{{grade}}` and `{{course_average}}` remain manually insertable via the existing variable chips; the chips were not changed. Missing optional values cause the containing sentence to be omitted rather than guessing.
- Canvas **assignment** mean is not Canvas **course** mean. The old CourseStatisticsService calculated averages from submissions; the new optional course-average resolver returns unavailable unless an independently verified Canvas-wide value is supplied. Do not present an assignment mean as a course mean.

## Persisted data policy
The local PostgreSQL containers and database are shared between worktrees. Never drop tables, truncate feedback history, delete a teacher's templates or reinitialize Docker volumes just to refresh defaults.
The diagnostic `tools/diagnostics/refresh-english-default-templates.mjs` defaults to read-only and uses an exact-match comparison against historical seeded content, with an on-disk backup and SQL transaction if `--apply` is later used on eligible rows. Initial dry run found 6 existing records matching template names, 0 exact matches, 6 protected. No records were overwritten. Seeded defaults in code will be neutral on a genuinely new installation. Existing customizations require owner-aware review/migration before a live DB reset.

## Testing
`apps/server/tests/unit/canvas-neutral-templates.test.js` tests all three seeded defaults, new-editor defaults, neutral Canvas score boundaries, 10/50/100-point scaling, invalid data, range selection, and missing or voluntarily inserted variables. Installer/server regression suite: 259 passed, 1 skipped, 0 failed, before the final documentation step.

## Future Spanish parity checklist
1. Move the neutral defaults into the Spanish templates and editor; eliminate the default `{{promedio_curso}}` and preview examples, preserving dynamic-variable UI.
2. Port `CanvasScorePolicy` and adapt `TemplateManager` and `FeedbackGenerationService` to Canvas native raw points, not the Chilean 1–7 scale.
3. Implement optional resolvers and omission tests for `{{calificacion}}` and `{{promedio_curso}}`; never manufacture missing values.
4. Respect teacher-owned customized templates and backup before any selective data regeneration.
5. Run the isolated first-install scenario plus update/edit/high-medium-low E2E tests independently, and verify no grade changes or unexpected AI prompts.

## Verified database regeneration and first-run simulation

After examining the persisted rows, the six English records consisted of three global defaults and three teacher-owned copies whose JSON was byte-for-byte equal to each corresponding global source. An exact historical Git seed text comparison was overly restrictive because persisted data originated from a prior version; the final migration therefore accepts only an English global default with all three ranges containing `{{grade}}`, plus owned clones precisely identical to that global record. All other rows stay protected. A read-only dry run identified exactly six eligible rows.

Executed `node tools/diagnostics/refresh-english-default-templates.mjs --apply` against the existing local shared PostgreSQL, with transactional updates and an automatically created backup: `logs/english-default-templates-backup-2026-10-26T14-39-16-370Z.json` (local only; do not publish). Updated 6 of 6 records; verification confirmed that all six now have no `{{grade}}` or `{{course_average}}`. No tables, feedback history, unrelated templates, or Docker volumes were removed.

Executed `node tools/diagnostics/verify-english-template-bootstrap.mjs`: created an isolated temporary table, inserted the three default seeds from the actual repository source, cloned all three for a synthetic new teacher, validated all 3 content ranges and absence of automatic grade/average tags, then rolled the transaction back. PASS: 3 defaults, 3 clones, 0 inserted grade variables. This is a real PostgreSQL seed test, not a full UI/Canvas installation restart.

The grade and course-average dynamic variable chips are intentionally unchanged. A missing optional value removes its line. The course-average resolver does not invent a course-wide average from assignment statistics; it requires a verified Canvas-wide value to be supplied in context. The saved historical Chilean grade fields are left null in the revised graded generation path; audit consumers of those legacy fields in Spanish parity work.
