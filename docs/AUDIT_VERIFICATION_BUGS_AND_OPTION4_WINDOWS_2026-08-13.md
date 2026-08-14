# Audit and Verification of Bugs and Option 4 on Windows

**Project:** Plugin-Feedback-Canvas  
**Date:** 2026-08-13  
**Repository:** `D:\Descargas\Proyecto Plugin feedback\Plugin-Feedback-Canvas`  
**Execution Platform:** Windows, `cmd.exe`, natively installed Node.js  
**Required and Audited Branch:** `main`  
**Audited Initial Commit:** `9ccf1a6a33781e61c9aff619e49bf1ec5dcfcf8c`  

## 1. Scope, constraints, and verification criteria

This phase was exclusively an audit, dependency installation, compilation, and testing. No code, configuration, Git state, containers, images, volumes, clones, branches, or data were modified. The only addition to the repository is this report, requested as a deliverable. Personal Markdown files located in `D:\Descargas\Proyecto Plugin feedback`, outside the repository, were inventoried and left untouched.

A bug is only classified as **fixed** when there is executed evidence that directly proves the behavior at the available level. **Partial** means that one layer is covered, but another necessary layer is missing or a defective alternative flow remains. **Not fixed** means that the current implementation still reproduces or preserves the cause. **Not verifiable** means that Canvas, Docker, PostgreSQL, Gotenberg, credentials, or an external service was missing and there is no sufficient executable substitute.

A distinction is made between:

- **Unit:** isolated process, with simulated dependencies.
- **Integration:** real interaction between modules and/or ephemeral PostgreSQL.
- **E2E:** browser and complete system, with local or real Canvas.
- **Manual:** inspection or directed execution from CMD without assertion automation.
- **Static:** reading of code/configuration; does not equal a passed test.

## 2. Git baseline and environment

The audit began with the mandatory commands:

```bat
cd /d "D:\Descargas\Proyecto Plugin feedback\Plugin-Feedback-Canvas"
git status
git branch --show-current
git rev-parse HEAD
```

Initial result:

- `git status`: clean tree, `main` aligned with `origin/main`.
- Branch: `main`.
- Commit: `9ccf1a6a33781e61c9aff619e49bf1ec5dcfcf8c`.

Relevant recent changes inspected:

| Commit | Description | Relevance |
|---|---|---|
| `9ccf1a6` / `86a84ee` | Onboarding documentation and local setup | Windows procedure |
| `02c908f` | Default browser and compact TLS output | Browser/certificates |
| `cf88dd3` | Certificate bootstrap by platform | Windows, `mkcert`, TLS trust |
| `73b0bb6` | Local Canvas runtime and LTI bootstrap | Docker, ports, local Canvas |
| `d400212` | New Docker runtime inspection | Docker Desktop/daemon |
| `ce2b6d0` | Broad sync/refactoring | Functional bugs, monorepo, and installer |

Environment observed from CMD:

| Component | Result |
|---|---|
| Node.js | `v24.13.1`, `D:\Componentes\nodejs\node.exe`; compatible with `^20.19.0` or `>=22.12.0` |
| npm | `11.8.0`, matches `packageManager` |
| Docker CLI | `29.6.2`, available |
| Docker Compose | `v5.3.1`, available |
| Docker Context | `desktop-linux` |
| Docker Engine | **Not available**: `dockerDesktopLinuxEngine` pipe non-existent; Docker Desktop was not started |
| `mkcert` | Not found in `PATH` |
| `winget` | Not found in `PATH` |
| Local certificates | `apps/server/certs` does not exist |
| Hosts | `canvas.docker` entry does not exist |
| Ports | No listeners on `3000`, `5173` or `8443` at the end of tests |
| Repository permissions | Current user and authenticated users with modification permission; Administrators/SYSTEM with full control |
| `.env` / setup | `.env`, `.setup_complete` and sibling clone `canvas-lms-master` do not exist |

## 3. Executive summary

The overall conclusion is **not approved to declare complete correction on Windows**.

- 1 bug is credited as fixed at the code/migration layer with an executed unit test: bug 4.
- 5 bugs are partial: 1, 2, 3, 9, and 10.
- 4 bugs remain unfixed: 5, 6, 7, and 8.
- The **external option 4 of the installer does not fully work from CMD/Windows**. The submenu is reached, but the options using `npx.cmd` fail with `spawnSync npx.cmd EINVAL`.
- The root suite is not green on Windows: 109 tests pass, 1 fails, and 1 is skipped. The failure is a non-portable Linux assertion in `local-workspace-paths.test.js`.
- `lint`, `build`, client tests, and isolated backend tests pass; that does not test the Canvas, campaigns, email, Gotenberg, or RF06 flows end-to-end.
- The LTI E2E could not be executed due to the lack of Canvas on `https://localhost:8443`; the global execution hung and was terminated by a timeout at 600 seconds.

## 4. Matrix by bug

| # | Status | Concrete evidence | Files involved | Executed test and result | Risk | Correction proposal |
|---:|---|---|---|---|---|---|
| 1 | **Partial** | UI and contract consider `EDITADO`; mass SQL selects `PENDIENTE` and `EDITADO`. Then it marks `APROBADO` and launches the Canvas upload in a non-durable and unawaited promise. | `packages/contracts/src/feedback.js:14`; `apps/client/src/views/feedback/review/useFeedbackReview.js:280`; `FeedbackTable.jsx:35`; `apps/server/src/services/FeedbackWorkflowService.js:49-90`; `apps/server/tests/unit/audit-regressions.test.js:159-173` | Backend unit: passes and checks SQL/teacher/count. No DB/Canvas integration or E2E. | A crash after marking `APROBADO` can leave feedback unpublished and out of future batches. | Durable job/outbox, retriable intermediate state, PostgreSQL+gateway test, and batch E2E with `EDITADO`. |
| 2 | **Partial** | The main panel uses an in-memory guard, disables during sending, closes on success, and the backend claims the record atomically. The alternative flow `FeedbackDetailView` passes incompatible props to `ConfirmDialog` and the route does not deliver `feedback`. | `useFeedbackReview.js:230-252`; `ApprovalModal.jsx:217-224`; `FeedbackRepository.js:173-182`; `audit-regressions.test.js:176-228`; `FeedbackDetailView.jsx`; `useFeedbackDetail.js`; `TeacherLayout.jsx`; `ConfirmDialog.jsx` | Concurrency backend unit: passes, a single simulated Canvas publish. No React/E2E test of closing. | Double action mitigated in the main panel, but the alternative detail is broken/does not render and is unprotected by test. | Fix props/route contract, reuse the same idempotent hook, and add component test with double click and successful close. |
| 3 | **Partial** | Route, controller, service, repository, and DTO handle `nota_privada`; the UI waits for the mutation before approving. The route test mocks the controller and does not touch PostgreSQL. No teacher-feedback ownership control is observed in the `UPDATE`. | `private_notes.routes.js`; `PrivateNoteController.js`; `PrivateNoteService.js`; `FeedbackRepository.js:213-218`; `FeedbackQueryService.js:84,123,157`; migration `006_add_nota_privada...sql`; `audit-regressions.test.js:42-85` | Units: pass ID validation and DTO mapping. No persistence integration or reload E2E. | Note may not persist in a real environment; a teacher with permission could modify someone else's ID if they know the ID. | Insert/update/read integration test, filter by teacher/course, and UI test that saves, reloads, and verifies. |
| 4 | **Fixed** (code/migration) | `StudentRole` delivers `view_feedback=true`; migration 022 forces `true` on both insert and update of the student role. | `apps/server/src/modules/permissions/roles/StudentRole.js:3-9`; `packages/plugin-database/migrations/022_normalize_role_permissions.sql:4-23`; `audit-regressions.test.js:88-90` | Executed unit: passes. The migration was not applied to a real DB in this phase. | Low in new code; medium if an installation does not run the migration. | Add real migration test and permissions smoke test after upgrade. |
| 5 | **Not fixed** | The first visit per session to assignments runs `POST .../assignments/reset-active`, which persistently deactivates assignments. The PDF viewer does not reset `pageNumber`, `numPages`, `scale`, or `error` when `fileUrl` changes. Each preview downloads/converts without cache, deduplication, or concurrency limit. | `apps/client/src/views/cursos/hooks/useAssignmentList.js:48`; `course.routes.js:33`; `CourseService.js`; `ConfigRepository.js`; `SubmissionViewer.jsx:164-165`; `NativePdfViewer.jsx`; `FileController.js`; `file-controller.test.js` | Gotenberg allowlist/endpoint unit only: passes. Does not test navigation, cache, concurrency, or saturation. E2E unavailable. | High: incorrect state when navigating; obsolete preview; repeated conversions and memory/Gotenberg saturation. | Remove destructive reset on read, reset viewer by URL or use `key`, cache/deduplicate conversions, and add limits, metrics, and repeated navigation E2E. |
| 6 | **Not fixed** | No module, routes, view, service, or tests for campaign importing were found in `apps/` or `packages/`; there is only a non-equivalent CSV/Excel report export. | Global search for `campaign`, `campaña`, `import`, and current routes; `exportFeedbackExcel.js` is not campaign importing. | Static inspection; no executable unit/integration/E2E of the requirement exists. | Functionality absent or lost in recent sync. | Recover/specify campaign contract and importer, validate schema/errors, transaction and idempotency, and cover with fixtures and integration. |
| 7 | **Not fixed** | There are preferences and notification logic, but production injects `emailService=null`. The test precisely verifies `NOTIFICATION_FAILED`; logs confirm "Email provider not configured". There are no campaigns with which to relate RF42/RF44. | `PreferencesService.js`; `NotificationPreferencesForm.jsx`; `FeedbackMutationService.js:188-195`; `FeedbackWorkflowService.js:132-140`; `dependencyInjection.js:70-77`; `docs/TECHNICAL_DEBT.md` | Unit with mocks: passes the failure path and error persistence. No real emails were sent. No campaigns/email integration. | RF42/RF44 cannot actually work in production; the batch lacks durable guarantee and the relationship with campaigns does not exist. | Production adapter or sandbox, outbox/retries, RF42/RF44 templates/events, and contractual tests with simulated provider. |
| 8 | **Not fixed** | The UI queries `/config/me` but does not use `meData` for AI availability; the endpoint does not expose AI state. AI controls remain active and the backend throws an error if there is no key. Manual mode is voluntary, not a read-only fallback. | `useSpeedGraderData.js`; `SpeedGraderPanel.jsx:30`; `AIControls.jsx`; `SystemConfigController.js`; `IAConfigManager.js:30` | Static inspection. No RF64 test exists. Not verifiable E2E without session/DB, but the cause is present in code. | Raw data or `[ERROR]` messages visible; invalid actions while loading; inconsistent UX. | Expose sanitized AI capability, explicit loading state, automatic read-only/manual fallback, and tests by matrix without key/inactive key/valid key. |
| 9 | **Partial** | The service tries to resolve name in Canvas and the unit test saves "Ada Lovelace". If it fails, it uses `Estudiante <ID>`; the client does not send name. The controller prioritizes `ltiUserId` over `canonicalUserId` for the teacher. | `ManualFeedbackController.js:15-48`; `FeedbackMutationService.js:43-46,249`; `audit-regressions.test.js:229-252` | Unit with simulated Canvas: passes. No Canvas integration/E2E. | On lookup failures the numeric ID reappears; possible use of the incorrect teacher identifier for the Canvas query. | Resolve identity from a canonical source, fail visibly instead of degrading to ID, and test LTI/canonical IDs against simulated Canvas. |
| 10 | **Partial** | There is view, routes, and dynamic discovery. The global creation writes a JavaScript resolver to the source tree and returns example data; the documentation itself marks RF06 experimental and E2E criteria pending. | `global_variables.routes.js`; variables controllers/services; resolvers discovery; `docs/VARIABLES.md` | Static inspection. The endpoint was not called because it would have modified source code, forbidden in this phase. No integration/E2E. | Does not work in immutable deployments or multiple replicas; there is no transactional catalog, rollback, or end-to-end demonstration. | Persist definitions in DB, sandbox for versioned expressions/resolvers, validation, and E2E create→configure→generate feedback. |

## 5. Detailed evidence by functional groups

### 5.1 Review, individual sending, and notes (bugs 1–3)

The test `apps/server/tests/unit/audit-regressions.test.js` provides useful but limited evidence:

- The batch includes `EDITADO` in the SQL and restricts by teacher.
- Two concurrent approvals only allow one call to the simulated Canvas gateway via `claimForApproval`.
- The note route rejects a non-numeric ID and accepts a valid one.
- The DTO preserves `nota_privada` and numeric zero values.

It does not test PostgreSQL, real modal closing, or publishing to Canvas. In the mass sending, `FeedbackWorkflowService.bulkApproveAndSend()` changes to `APROBADO` within a transaction and then triggers `_processCanvasUploadsInBackground()` without awaiting or persisting a job. The response `{status: 'processing'}` does not mean Canvas received the feedback.

The main modal flow is reasonably protected. However, `FeedbackDetailView` mounts `ConfirmDialog` without the `isOpen` prop and passes `onCancel` where the component expects `onClose`; furthermore the `TeacherLayout` route does not deliver the feedback to it. Therefore, not all individual sending can be declared fixed.

### 5.2 Navigation, preview, and Gotenberg (bug 5)

The most serious cause found is that an assignments read has a persistent effect: `useAssignmentList` calls `reset-active` once per session, and the backend updates the assignments to inactive. This can explain incorrect lists or previews when changing step or reactivating the plugin.

In parallel, `NativePdfViewer` maintains internal state when changing the document. If the previous PDF was left on a page that is non-existent for the new one, or produced an error, that state can contaminate the next render. `FileController.preview` downloads the file, keeps it in memory, and requests a new conversion to Gotenberg per request, without cache or coordination of concurrent requests. `stress_test_gotenberg.js` was not executed: it creates a large file, requires Gotenberg, and finally deletes it; also Docker was not operative.

### 5.3 Campaigns and notifications (bugs 6–7)

No current implementation of campaigns/importing was found. Therefore it cannot be verified nor can an operative RF42/RF44↔campaigns relationship be established.

No real emails were sent. Only tests with mocks and log evidence were used. In non-production mode there is `EmailServiceLocal`; in production `dependencyInjection.js` leaves the adapter as `null`, by design. The audited test checks that the failure is logged, not that a notification arrives. This coincides with the documented technical debt.

### 5.4 Read-only AI (bug 8)

The backend knows the absence of a key, but the client neither receives nor consumes a reliable AI capability before enabling controls. When the backend returns "No active API key found...", the UI has no guaranteed transition to read-only and its known error filters do not cover all variants. RF64 remains open.

### 5.5 Name in manual feedback and RF06 variable (bugs 9–10)

The name resolves correctly in the isolated test, but the explicit degradation to `Estudiante <ID>` preserves the symptom on any Canvas failure. A contractual identity test is required.

RF06 has visible pieces, but creating a global variable writes a resolver file inside the source. It was not executed because it would have violated the no-change phase. `docs/VARIABLES.md` also leaves the end-to-end criteria unchecked; that is why the status is partial and not fully fixed.

## 6. Option 4: verification from CMD

### 6.1 What exactly is option 4

The requested option is **option `[4]` from the main menu** of `npm start`, defined in `apps/installer/src/orchestration/cli.js`:

```text
[4] Validaciones de Caja Negra (Health Checks y Tests E2E)
```

`apps/installer/src/orchestration/main.js:45-49` routes it directly to `runBlackBoxTests(PLUGIN_DIR)`, waits for Enter, and exits with code 0/1. Important: this path happens before `prepareEnvironment`; by itself it does not guarantee that `.env`, Canvas, DB, TLS, or Docker are ready.

The actual submenu, defined in `apps/installer/src/orchestration/testRunner.js`, executes:

| Sub-option | Effective command | Infrastructure | Real coverage |
|---:|---|---|---|
| 1 | `npx.cmd --no-install vitest run apps/server/tests/` | None for units; Docker integration is skipped without `RUN_DOCKER_TESTS` | Backend only; not installer, client, or E2E |
| 2 | Starts `node apps/installer/src/preboot.js --mode=1` with `USE_LOCAL_DATA=true`; then `node apps/server/tests/e2e/smoke.mjs` | Local backend/DB/config | Health/JWKS, not the 10 bugs |
| 3 | Starts `preboot.js --mode=3`; then `npx.cmd --no-install playwright test apps/client/tests/e2e/lti-flow.spec.js` | Docker, local Canvas, TLS, LTI | LTI flow only; not full E2E suite |
| 4 internal | `npx.cmd --no-install playwright test apps/client/tests/e2e/lti-flow.spec.js` with `E2E_TARGET=real` | Real Canvas and credentials | Real LTI flow only |
| 5 | Four mode 1 starts and `node apps/server/tests/e2e/stress.mjs` for `baseline`, `idempotency`, `circuitbreaker`, `ratelimiter` | Backend/DB | Technical performance, not full functional coverage |

The internal option 4 must not be confused with the main option 4 requested by the user.

### 6.2 Executed result on Windows/CMD

Reproducible manual sequence:

```bat
cd /d "D:\Descargas\Proyecto Plugin feedback\Plugin-Feedback-Canvas"
npm start
```

Then type `4` in the main menu and `1` in the submenu. The observed result was:

- The main menu and the submenu were shown.
- Sub-option 1 ended with code 1 and generic message: `La suite local encontro fallos o no pudo ejecutarse.`
- Vitest output did not appear.
- The equivalent command launched directly from CMD did pass: 7 backend files passed, 1 integration skipped; 25 tests passed and 1 skipped.

The cause was isolated with this safe command from CMD:

```bat
node -e "const {execFileSync}=require('node:child_process');try{execFileSync('npx.cmd',['--no-install','vitest','--version'],{stdio:'inherit'});console.log('OK')}catch(e){console.error(e.code,e.errno,e.syscall);process.exit(1)}"
```

Result: `EINVAL`, `-4071`, `spawnSync npx.cmd`. `testRunner.js:160-162` correctly chooses the name `npx.cmd`, but `execFileSync` cannot launch it this way on this Windows. Sub-options 1, 3, and internal 4 share the same defect. Furthermore, `runProcess` discards the original error, preventing diagnostics from the console.

Usage via pipe was also checked:

```bat
(echo 4&echo 1&echo.)|npm start
```

By creating a new `readline` interface for each question, the second prompt lost the piped input and the process ended without running tests. It does not replace a human TTY session, but it demonstrates that CMD/CI automation of the menu is also not robust.

### 6.3 What tests option 4 actually ran

The interactive path reached the runner, but **did not execute Vitest** due to the `spawnSync npx.cmd EINVAL` error. To separate the menu bug from the test state, it was executed directly:

```bat
cmd.exe /d /s /c "npx --no-install vitest run apps/server/tests/"
```

Result: passed with 25 tests, one integration skipped. This does not make option 4 approved: it proves that the backend suite works when CMD resolves `npx`, while the orchestrator fails.

### 6.4 Coverage and limitations of option 4

- Sub-option 1 does not run installer, React, or Playwright tests.
- Sub-options 3/4 only point to `lti-flow.spec.js`, not to the ten bugs.
- The LTI flow requires local/real Canvas, LTI registration, and credentials.
- Sub-options 2/5 can start services and write configuration via `preboot`; they were not executed in this phase.
- The local mode can clone Canvas and manage Docker/certificates. It was not executed because Docker Engine was off and because `CanvasCloner.js:145-147` automatically calls `docker compose down` after the first `up` failure, an unauthorized operation in this audit.

**Option 4 verdict:** **does not fully work from CMD/Windows** and does not offer sufficient coverage for the bugs, even after fixing the `npx.cmd` launch.

## 7. Quality and test commands executed

| Command from CMD/Windows | Type | Result | Interpretation |
|---|---|---|---|
| `npm ci` | Reproducible preparation | Passed: 986 packages. The first restricted attempt could not write npm logs; with normal execution permission it finished well. | Dependencies installable on Windows. `npm ls --depth=0` marks five optional/extraneous WASM packages, with no required dependencies missing. |
| `npm test` | Root unit | **Failed**: 34 files pass, 1 fails, 1 integration is skipped; 109 tests pass, 1 fails, 1 is skipped. | Suite not green on Windows. |
| `npm run lint` | Static quality | Passed, code 0. | Does not test behavior. |
| `npm run build` | Client build | Passed, 351 modules. Warning for chunks >500 kB (`exceljs` ~930 kB and PDF viewer ~421 kB). | Compiles; performance risk remains, not functional validation. |
| `npm run test:client` | Storybook unit/components | Passed: 4 story files, 12 tests; 1 MDX skipped. | No story covers the audited bugs. |
| `npx --no-install vitest run apps/server/tests/` | Backend unit | Passed: 7 files, 25 tests; 1 integration skipped. | Isolated backend. |
| `npm run test:e2e` | Playwright E2E | **Not passed**: global timeout at 600 s; LTI fails with `ERR_CONNECTION_REFUSED` on `https://localhost:8443/login/canvas`. | Canvas/backend unavailable. No functional verdict for the bugs. |
| `npm run diagnose` | Manual diagnostics | **Failed**: 10 correct, 4 warnings, 7 errors. | `.env`, LTI/Canvas/AI variables, and services missing; Docker daemon off. |
| `docker compose ... config --quiet` | Compose static validation | Passed for base, base+dev, base+prod, and DB. | Valid syntax/merge; does not prove startup. |

Exact failure of `npm test`:

```text
apps/installer/tests/unit/local-workspace-paths.test.js:12
expected: /work/canvas
received: D:\work\canvas
```

The implementation uses `path.resolve`, so the native separator and resolution are expected; the test hardcodes a Linux result and constitutes a suite portability regression.

The Playwright browser was not installed. Only the testing Chromium was installed via:

```bat
npx --no-install playwright install chromium
```

It was downloaded to the Playwright cache (`D:\DevCaches\ms-playwright`); the user's default browser was not opened.

### Actual quality of existing E2Es

`massive-feedback.spec.js` catches and discards the title failure and ends with `expect(true).toBe(true)`. `login.spec.js` also only asserts `true`. Those cases can pass even if the functionality does not exist. `lti-flow.spec.js` does navigate to Canvas, but could not start due to absence of the service. The existence of these files does not accredit any bug.

The PostgreSQL integration uses Testcontainers and was skipped. `npm run test:integration` was not forced because it automatically creates and deletes ephemeral containers; doing so would have violated the explicit prohibition of deleting containers without authorization.

## 8. Windows Regressions

| Area | Status | Evidence / regression |
|---|---|---|
| Paths | **Confirmed failure** | Linux test expects `/work/canvas`; Windows produces `D:\work\canvas`. Sibling workspace default logic is native, but root suite turns red. |
| CMD / processes | **Confirmed failure** | `execFileSync('npx.cmd', ...)` produces `spawnSync EINVAL`; breaks option 4 sub-options 1, 3, and internal 4. The `catch` hides cause/code. |
| Interactive input | **Failure in pipe mode** | Multiple `readline` instances lose answers when piping answers to `npm start`; affects CI/automation via CMD. |
| Native Node | **Partial pass** | Node 24/npm 11 correct; installation, lint, build, and isolated suites work. Node 20, declared minimum version, was not tested. |
| Docker Desktop | **Not verifiable in runtime** | CLI/Compose present; `desktop-linux` daemon off. Four Compose configurations validate syntax. Containers were not inspected or altered. |
| Docker Security | **High risk** | After `compose up` fails, the installer runs `docker compose down` without confirmation (`CanvasCloner.js:145-147`). Although it does not add `-v`, it removes project containers/network and violates the requested policy. It was not executed. |
| Compose dev | **Static risk** | The dev override replaces the container command with `npm run dev` (Vite); verify that backend/port 3000 remain available in the final design. There was no runtime. |
| Certificates | **Blocked** | `mkcert` and `winget` unavailable, certificates absent, and hosts without `canvas.docker`. Bootstrap units pass, but do not test actual installation/trust. "Existing cert" does not revalidate that the CA remains trusted. |
| Default browser | **Partial** | Resolver unit passes and code uses `cmd.exe /d /s /c start "" URL`. A browser was not opened as it is an external action; the user's actual association could not be read in this context. |
| Permissions | **Partial pass** | ACL allows project write. First restricted npm install failed writing `D:\DevCaches\npm\_logs`; execution with normal permissions finished. |
| Ports | **Passed at closing** | 3000/5173/8443 without listener. The E2E fails precisely because 8443 is not served. |
| Logs | **Partial pass** | `logs/server.1.log` was generated, ignored by Git, with JSON and Windows paths. It logs simulated webhook/email failures; no secret detected. No rotation/prolonged load. |
| Messages/encoding | **Risk** | Some Playwright artifacts show UTF-8 text as mojibake (`DeberÃ­a`). Files are LF versioned and the terminal may depend on codepage. Must be tested with usual CMD `chcp`. |
| Line endings | **Static pass** | `.gitattributes` forces LF; key files report `i/lf w/lf`. Suitable for Docker, but a new checkout under a different `core.autocrlf` was not tested. |
| Diagnostics | **Misalignment** | `npm run diagnose` demands `GEMINI_API_KEY` in environment, while current app manages AI keys in DB via `IAConfigManager`; may produce false requirement after refactoring. |
| Shutdown | **Partial** | Special Ctrl+C handling for CMD exists. Prolonged shutdown test for backend/Vite/Docker was not done. |

## 9. Versioning, caches, secrets, and artifacts

Safe commands executed:

```bat
git ls-files "*/node_modules/*"
git clean -ndX
git ls-files --eol package.json apps/installer/src/orchestration/testRunner.js apps/installer/src/orchestration/cli.js
git grep -n -I -E "BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|AIza[0-9A-Za-z_-]{20,}|sk-[0-9A-Za-z_-]{20,}"
```

Results:

- Zero `node_modules` files currently versioned. Recent sync removed dependencies that did appear in historical commits.
- `.gitignore` covers dependencies, builds, Vite, coverage, `.env`, certificates, logs, Playwright, and setup state.
- Ignored local artifacts generated by this audit: `node_modules/`, `apps/client/node_modules/`, `apps/server/node_modules/`, `dist/`, `logs/`, and `apps/client/test-results/`.
- These artifacts were not deleted because deletion was not authorized.
- No private keys or tokens with the reviewed patterns were found in the current versioned tree. `apps/server/src/config/secrets.js` is a secrets registry, not an embedded secret.
- This **does not certify the Git history**. `docs/GITLEAKS.md`/`docs/TECHNICAL_DEBT.md` register historical findings of private keys and pending rotation. Gitleaks was not available/executed in this phase.

Git state immediately before creating this report: `## main...origin/main`, clean. After creating it, the expected change is only this unversioned Markdown; the previous artifacts remain ignored.

## 10. Exact and safe commands to reproduce

### 10.1 Baseline and environment

```bat
cd /d "D:\Descargas\Proyecto Plugin feedback\Plugin-Feedback-Canvas"
git status
git branch --show-current
git rev-parse HEAD
where node
node --version
npm --version
where docker
docker --version
docker compose version
docker context show
```

### 10.2 Dependencies, quality, and tests without external services

```bat
npm ci
npm ls --depth=0
npm test
npm run lint
npm run build
npm run test:client
npx --no-install vitest run apps/server/tests/
npm run diagnose
```

`npm ci` and `build` create ignored artifacts; they do not modify versioned files. `npm run diagnose` is read-only except for its logs.

### 10.3 Option 4 from CMD

```bat
npm start
```

Enter `4`, then `1`. To reproduce only the Windows process defect without entering the menu:

```bat
node -e "const {execFileSync}=require('node:child_process');try{execFileSync('npx.cmd',['--no-install','vitest','--version'],{stdio:'inherit'});console.log('OK')}catch(e){console.error(e.code,e.errno,e.syscall);process.exit(1)}"
npx --no-install vitest --version
```

The first command fails inside `execFileSync`; the second works resolved by CMD.

### 10.4 Static Compose, without starting or deleting resources

```bat
docker compose -f docker-compose.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.dev.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.prod.yml config --quiet
docker compose -f docker-compose.db.yml config --quiet
```

Do not execute `docker compose down`, `docker system prune`, `docker volume rm`, `docker image rm`, or equivalent cleanup without authorization.

### 10.5 E2E, only when local Canvas is already up authorized

```bat
npx --no-install playwright install chromium
npm run test:e2e
```

For real Canvas, do not run until you have a sandbox account and authorization to use it. Variables expected by the runner are `CANVAS_URL`, `CANVAS_TEST_USER`, `CANVAS_TEST_PASS`, and `CANVAS_TEST_COURSE_ID`. Do not use a production account.

### 10.6 Safe reproduction by bug

| Bug | Current safe command/test | What is missing for conclusive test |
|---:|---|---|
| 1 | `npx --no-install vitest run apps/server/tests/unit/audit-regressions.test.js -t "aprobacion masiva"` | PostgreSQL + Canvas mock and React E2E selecting `EDITADO` |
| 2 | `npx --no-install vitest run apps/server/tests/unit/audit-regressions.test.js -t "sola aprobación concurrente"` | Modal component test and double click |
| 3 | `npx --no-install vitest run apps/server/tests/unit/audit-regressions.test.js` | Real/ephemeral DB and UI reload |
| 4 | `npx --no-install vitest run apps/server/tests/unit/audit-regressions.test.js -t "view_feedback"` | PostgreSQL migration and student login |
| 5 | `npx --no-install vitest run apps/server/tests/unit/file-controller.test.js` | Navigation E2E + controlled Gotenberg and concurrency metrics |
| 6 | No executable test exists | Campaigns implementation/fixtures |
| 7 | `npx --no-install vitest run apps/server/tests/unit/audit-regressions.test.js -t "notificacion"` | Email sandbox and campaign events; no real sending |
| 8 | No RF64 test exists | UI/API matrix with AI active/inactive/no key |
| 9 | `npx --no-install vitest run apps/server/tests/unit/audit-regressions.test.js -t "nombre del estudiante"` | Canvas sandbox or contractual gateway |
| 10 | Do not run current creation: writes source | Authorized ephemeral environment and E2E after persistent redesign |

The `-t` filters depend on the exact current text; if a filter finds no tests, run the entire file and confirm the name with `npx vitest list` before interpreting the result.

## 11. Unverifiable elements in this phase

- Real Docker Compose startup, PostgreSQL/Gotenberg/Canvas health, and DB persistence.
- Complete LTI registration and launch from local or real Canvas.
- Certificate trust on Windows and opening the default browser.
- Real RF42/RF44 delivery by an email provider. Not attempted.
- Campaigns import: no identifiable implementation exists.
- RF06 end-to-end: the current endpoint would have written code.
- Multi-user behavior, process restart during a batch, and retries after a crash.

These limitations do not make the behaviors approved; they maintain the indicated partial/unfixed states.

## 12. Proposed prioritized fix plan

1. **P0 — Windows/option 4:** replace `npx.cmd` launch with a Windows-compatible strategy (`cmd.exe /d /s /c` with carefully escaped arguments, or direct JS API/binary), preserve original error/code, and add Windows test. Make the menu automatable with a single entry interface.
2. **P0 — Avoid implicit destruction:** remove or request explicit confirmation before `docker compose down`; log the exact project/resources. Do not touch volumes.
3. **P0 — Bug 5:** remove `reset-active` on read/navigate; fix PDF viewer lifecycle and add Gotenberg cache/deduplication/limits.
4. **P0/P1 — Bugs 6–7:** recover/implement campaigns and define RF42/RF44; connect a sandbox/production provider via outbox and tests without real email.
5. **P1 — Bug 8:** AI capability contract and automatic read-only fallback, with sanitized loading/error states.
6. **P1 — Bugs 1–3:** durable mass sending job; fix alternative confirmation flow; reinforce authorization and note DB test.
7. **P1 — Bug 9:** normalize Canvas/LTI IDs and do not show/send ID as name on failures.
8. **P1 — Bug 10:** persist variables in DB or a controlled registry, without writing source at runtime; complete RF06 E2E.
9. **P1 — Tests:** fix portable path expectation; replace E2E `expect(true)` with business assertions; make option 4 run installer+backend+client and report explicit skips.
10. **P2 — Windows Setup:** align `doctor` with AI in DB, test `mkcert`/trust/hosts/browser with fixtures, and document CMD codepage/UTF-8.

## 13. Exit decision

It is not recommended to declare the ten bugs fixed or approve option 4 for Windows on the audited commit. No code or configuration corrections have been made. Explicit authorization is required before starting the changes phase, raising/creating Docker resources that must later be deleted, using Canvas/sandbox email, or cleaning generated artifacts.
