# Real Canvas / Plugin Feedback parity validation — 2026-11-12

## Scope, revisions and guardrails

- Spanish reference: `origin/main`, commit `b4a11a50b13cab2229ec77cfd8a6648e2edeab71`.
- English revision under validation: `english-version`, commit `d3bc761e76d6281c54337885aa2038a42e5f9b8f`.
- Source for Spanish tests: **temporary detached Git worktree on D:**, not a second permanent project clone.
- All test artifacts and npm's reference cache are under
  `D:\\Documentos\\MDL\\Informatico\\Plugin-Feedback-Parity-QA`.
- No push to GitHub; `main` stays unchanged.
- The installed and running Canvas in `/home/jaime/proyectos/canvas-lms-master`
  is never stopped, recreated, updated or used for fault injection.
- Disposable Docker projects use randomized, strictly validated names; their
  volumes/containers are removed after their scenarios, and unrelated container
  states are compared before and after.
- All deliberately corrupted schemas and FK test records are synthetic and
  live only in disposable PostgreSQL instances.

## Executed real scenarios

| Independent scenario set | Spanish main | English | Comparison |
|---|---|---|---|
| Healthy state, single/double stopped dependencies, four negative authorization and identity checks | 7/7 PASS | 7/7 PASS | PASS |
| PostgreSQL/Gotenberg automatic recovery, Redis safety gate, port/owner/credentials checks, real plugin migrations and idempotency | 14/14 PASS | 14/14 PASS | PASS |
| Missing/incomplete/initialized Canvas schema, PostgreSQL stop/start, aborted transaction rollback and safe reapply | 6/6 PASS | 6/6 PASS | PASS |
| Actual SQLSTATE 23503 on `fk_rails_337ba633a9`, read-only post-failure integrity check and conservative diagnostic classification | 4/4 PASS | 4/4 PASS | PASS |
| **Total independently compared real checks** | **31** | **31** | **31 PASS** |

These are not mock-only tests. The Docker/PostgreSQL actions and state
transitions occurred in real disposable containers. PostgreSQL availability is
waited for before triggering the FK fault; a container being marked healthy is
not alone sufficient to prove the requested database is queryable.

The test intentionally creates the real foreign-key violation, then provides
its error signature as **synthetic Rails-style diagnostic input**. This verifies
PostgreSQL enforcement and the diagnostic classifier; it does **not** prove the
professor's exact Canvas login controller exception has occurred in Rails.

Comparison artifacts:
- `reports/english-three-recovery.json`, `reports/spanish-main-three-recovery.json`
- `reports/english-full-dependency-recovery.json`, `reports/spanish-main-full-dependency-recovery.json`
- `reports/english-canvas-preflight.json`, `reports/spanish-main-canvas-preflight.json`
- `reports/english-canvas-fk.json`, `reports/spanish-main-canvas-fk.json`
- `reports/parity-comparison.json` and `reports/parity-comparison.md`

All paths above are relative to the D: laboratory directory.

## Live Canvas read-only observation

English `CanvasReadOnlyDiagnosis` was executed against the existing Canvas,
with NO start/stop/recreation, NO recovery, NO DB writes and NO credential
submissions. It returned **HEALTHY**, with **11/11 checks OK** (Canvas files,
three services, Rails log sample, migration history, database, root account,
orphaned terms, FK constraints and shards). The diagnosis wrote its normal
local JSON report; a sanitized evidence summary is in
`reports/english-active-canvas-readonly.json`. Docker state was unchanged.

This is not a real login E2E test and does not guarantee a particular LTI flow.

## Automated regression

The English branch was revalidated after the real-QA additions with
**469 Vitest passed / 21 skipped**, **119 Python QA passed**,
**13 Python diagnostic tests passed**, ESLint and production build successful.
The Spanish reference is also checked independently in
`reports/spanish-main-ci.json` if its execution finishes.

Permission-sensitive tests require a real POSIX temporary filesystem:
when `TMPDIR` was placed on D: (NTFS through WSL), `stat(0600)` reported
`0777`, causing misleading failures for restricted files and Ruby gem
cache recovery. No tests or assertions were weakened. The validated runner
uses `/dev/shm/feedback-parity-ci` (RAM-backed Linux tmpfs) for ephemeral
permission-sensitive fixtures, while all installed dependencies, npm cache,
Docker reports and retained evidence stay on D. Keep earlier failed-run
artifacts distinct from the latest successful run.

## Unverified or blocked full-stack validation

1. Two independent **complete Rails Canvas installations** from scratch,
   each with its own seeded accounts and database, were not created.
2. Real browser login, OAuth callback and full LTI 1.3 launch with isolated
   synthetic teacher/student/admin accounts has **not** been repeated under
   two full independent Rails stacks.
3. The original professor's actual login-controller FK exception was **not**
   reproduced in Rails; only the same PostgreSQL constraint and conservative
   diagnostic signature have been verified.
4. A deliberately damaged, full Rails installer including assets and
   filesystem state has not been subjected to the entire restore procedure.
5. Historical QA harnesses that depend on deleted legacy clones are not
   retargeted to live Canvas or its database to force an artificial pass.

These are **NOT VERIFIED**, not passed. In particular, the WSL environment
has about 8 GiB of RAM while the user's active Canvas services remain up;
creating two additional full Rails stacks without a separate capacity and
fixture plan risks disrupting the existing installation.

## How to reproduce

In the English working repository, run the isolated CLI tools below with
the explicit flags and D-only evidence root. Never change their safety
allowlists to point at the current Canvas installation.

- `tools/qa/parity_real_docker.py --source <source> --suite three|full --report <D JSON>`
- `tools/qa/parity_real_canvas_db.py --source <source> --suite preflight|foreign-key --report <D JSON>`
- `tools/qa/parity_compare_reports.py`
- `tools/qa/parity_live_readonly.mjs` (only after explicit live read-only consent)
- `tools/qa/parity_ci_validator.py --source <source> --label english|spanish-main`

For a source reference, use either the English repository root or the
temporary D: main worktree pinned to the exact `main` commit.

## Acceptance decision

**Real recovery/preflight/FK diagnostic parity: demonstrated (31 checks).**
**Full Canvas Rails/LTI end-to-end parity: NOT VERIFIED.**

Do not push to origin or claim the latter solely because all current
mock-based or database-level tests passed.
