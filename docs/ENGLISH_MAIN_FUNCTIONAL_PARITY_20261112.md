# English / Spanish main functional parity — 12 November 2026

## Reference and scope

- Baseline: `origin/main` at `b4a11a5` (Spanish).
- Target: `english-version` from `405ac81` (English).
- All changes are local. **Do not push without explicit approval.**
- Preserve English-specific quiz, templates, OAuth, frontend, backend and API behavior.
- Preserve the same failure conditions and assertions; translating literal output expectations is allowed, dropping or simplifying tests is not.
- Do not alter the running Canvas LMS, local Docker state, databases, credentials, `.env`, TLS certificates or installation markers during unit-test parity work.

## Coverage and automated results

| Validation | Spanish main reference | English parity |
|---|---:|---:|
| Installer Vitest suites | 63 passed | 63 passed |
| Installer Vitest tests | 307 passed | 307 passed |
| Entire Vitest suites | 99 passed, 4 skipped | 99 passed, 4 skipped |
| Entire Vitest tests | 469 passed, 21 skipped | 469 passed, 21 skipped |
| Independent Python QA unittest cases | Included in main QA tools | 119 passed |
| Python causal diagnostic unittest cases | Included in main diagnostic tools | 13 passed |

The original English installer started at 46 suites and 180 passing tests. We copied
the 17 missing suites directly from Spanish `main` and adapted ONLY language-dependent
expected strings. These are the same test cases, not shortened replacements.

The shared tests were checked for case/assertion counts: one English server test,
`apps/server/tests/unit/seed-submission-generator.test.js`, intentionally retains
**two additional assertions** already present on English. No assertions were removed.

## Ported features

- Console progress and subsection headings retaining the original two-space child indent.
- Read-only Canvas diagnostics under black-box validation option **6**, with structured
  support summary, privacy-preserving reports, migration history, foreign-key checks and
  safe failure behavior.
- Canvas database preflight and unknown-history fail-closed checks.
- Safe recovery for *owned*, stopped Docker services, interactive consent, ownership
  checks, time-of-check/time-of-use protection and bounded health verification.
- Resumable local setup and postflight verification; no implicit data purges.
- Login foreign-key incident classification and response observation.
- QA no-browser mode, isolated service ownership, external port conflict regression.
- Plugin database compatibility and migration status checks.
- English-facing prompts, explanations, warnings, menu labels and diagnostic codes'
  human-readable descriptions.
- Copied **64 missing QA/diagnostic support files** from main, including Python unit
  tests and isolated lab harnesses, while retaining English-only diagnostic tools.

## Verified constraints

- Interactive option 3 and live LTI/OAuth were successful in the **user's pre-parity
  install log**. They have *not* been rerun on the newly ported code.
- The test executions do not start, remove or recreate the user's Docker Compose
  services or Canvas databases.
- Historical full-stack failure injection and manual Docker/Canvas E2E scenarios
  require disposable opt-in environments and have **not** been run against the user's
  live instance. Their isolated security/behavior **unit tests** pass.
- Python QA scripts originally authored for Spanish historical labs may expect an
  isolated QA workspace and synthetic credentials. Do not point them at the current
  live Canvas just to force a pass. A separate disposable English lab is required
  before claiming end-to-end parity for those scenarios.
- Ported tests keep the original exception codes, migration preflight rules,
  audit privacy and service-ownership safeguards.

## Suggested checks in a later session

1. `npm run lint`
2. `CI=true npm test`
3. `python3 -m unittest discover -s tools/qa/tests -p 'test_*.py' -q`
4. `python3 -m unittest discover -s tools/diagnostics/tests -p 'test_*.py' -q`
5. Review option 4 > 6 read-only summary in English.
6. Run option 3 under human supervision and record observations without removing
   the existing Canvas installation.
7. Separately provision disposable QA environments for full end-to-end historical
   database, login and service-recovery fault injection.

This document is an inspectable record of automated coverage, not a claim that
untested real-world deployment scenarios are guaranteed.
