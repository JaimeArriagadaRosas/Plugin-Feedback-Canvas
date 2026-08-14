# Testing Strategy

The project uses several layers. "Test passed" is only useful if it is identified which dependencies were real and which were simulated.

## 1. Commands

| Command | Main coverage | Requirements |
|---|---|---|
| `npm run lint` | backend ESLint rules | installed dependencies |
| `npm test` | repository Vitest suite | Docker for tests with Testcontainers |
| `npm run test:backend` | tests under `apps/server/tests` | Docker for included integration |
| `npm run test:integration` | ephemeral PostgreSQL smoke | accessible Docker daemon |
| `npm run test:client` | Vitest/Storybook in browser | Playwright Chromium |
| `npm run test:e2e` | Playwright specs | Vite; Canvas/credentials according to spec |
| `npm run build` | production Vite compilation | installed dependencies |
| `npm run test:coverage` | Vitest coverage | same runtime as the suite |

Install reproducibly:

```bash
npx --yes npm@11.8.0 ci
```

For client:

```bash
npx playwright install chromium
npx --yes npm@11.8.0 run test:client
```

## 2. Layers

### Unit tests

They test rules, policies, and adapters with injected dependencies. They are appropriate for:

- authorization by role/context;
- version and platform validation;
- installer selection;
- path/process safety;
- Canvas configuration and memory policies;
- AI factory/providers without real calls.

A simulated Docker runner validates arguments and decisions, it does not prove that Docker/Canvas work.

### Integration

`apps/server/tests/integration/backend_smoke.test.js` uses Testcontainers with PostgreSQL. It demonstrates that the code can talk to a real ephemeral database and apply the expected smoke test.

Requires:

```bash
docker info
docker compose version
npm run test:integration
```

If the runtime is not available, the result is missing infrastructure, not a skipped pass.

### Client and Storybook

`npm run test:client` runs component/story tests in headless Chromium. It serves for rendering, states, and component regressions. It does not validate Canvas, PostgreSQL, email, or real LTI.

### Isolated E2E

`massive-feedback.spec.js` intercepts HTTP with `page.route()`. In its current state it is an initial harness: it checks that the page opens, but catches the title assertion and ends with a trivial condition. `login.spec.js` is also a minimal smoke test.

These tests are not yet a release gate. They must incorporate stable selectors, real interaction, and observable assertions before being presented as massive flow coverage.

### LTI E2E

`lti-flow.spec.js` opens Canvas, tries to authenticate, enters the course, and looks for the tool. In local mode it may skip the iframe validation when the link does not appear; therefore a local pass does not always test the full launch.

For a real target, explicit configuration is required:

```bash
E2E_TARGET=real \
CANVAS_URL=https://canvas-staging.example.edu \
CANVAS_TEST_USER=test-user \
CANVAS_TEST_PASS=secret \
CANVAS_TEST_COURSE_ID=123 \
npm run test:e2e
```

The validator rejects `localhost`, `.local`, and private networks when `E2E_TARGET=real`. Use only staging accounts and courses; do not log passwords in CI logs.

## 3. Known Linux branch baseline

The local validation logged on 2026-08-11 obtained:

| Evidence | Result |
|---|---:|
| Backend on Ubuntu/WSL2 with rootless Docker | 71/71 |
| Client/Storybook Chromium | 12/12; one documentation story skipped |
| ESLint backend | passed |
| Vite build | passed, with large chunks warning |
| Full local Canvas setup | assets, migrations, web/jobs/Redis/PostgreSQL and `/login` operative |

This table is a baseline, it does not replace the CI result of the current commit. WSL2 also does not by itself certify a physical/VM Linux host.

## 4. Current CI

`.github/workflows/security.yml` runs on every push/PR:

- build with Node 22.12.0 and npm 11.8.0;
- `docker compose config` validation;
- Gitleaks with history;
- TruffleHog for verified secrets;
- backend ESLint;
- Vitest suite;
- client/Storybook with Chromium.

The workflow does not run the real LTI E2E or the full Canvas setup. Those tests belong to a controlled staging matrix.

## 5. Minimum matrix by change type

| Change | Minimum evidence |
|---|---|
| Domain/backend | lint + affected test + backend suite |
| UI/component | component test/story + `test:client` + build |
| SQL/repository | migration + PostgreSQL integration + documented rollback |
| Authorization/LTI | negative unit tests + staging E2E of the affected role |
| Docker/setup | policy unit tests + clean run on affected platform |
| Shared platform | Windows + WSL2 + native Linux; macOS if its adapter changes |
| Production | image build + migration + health/readiness + LTI smoke + rollback |

## 6. Performance

The repository contains Autocannon and stress runners, but it does not keep a reproducible artifact alongside the code that backs up the historical figures of 15,000 requests, 1,500 RPS, or absence of leaks. Therefore those figures were removed from the normative documentation.

A publishable benchmark must record:

- commit, date, and command;
- CPU, RAM, OS, and Docker version;
- dataset and duration;
- mocks vs real services;
- p50/p95/p99 percentiles, throughput, and errors;
- CPU/memory/pool usage;
- results and artifact without sensitive data.

Do not run stress tests against Canvas, AI, or institutional email without authorization and agreed limits.

## 7. Release criteria

A production release requires, at a minimum:

- green CI of the exact commit;
- real LTI E2E by role and staging course;
- verifiable individual/massive generation, editing, approval, and sending;
- real email/notifications in staging;
- migration from a representative copy and tested rollback;
- clean setup/image on native Linux;
- observability, backup/restoration, and security scanning.
