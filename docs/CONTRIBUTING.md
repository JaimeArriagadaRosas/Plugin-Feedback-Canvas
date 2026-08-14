# Contribution Guide

## 1. Prepare the repository

```bash
git clone https://github.com/JaimeArriagadaRosas/Plugin-Feedback-Canvas.git
cd Plugin-Feedback-Canvas
npx --yes npm@11.8.0 ci
```

Requirements: Node `^20.19.0 || >=22.12.0`, npm 11.8.0, and Git. Docker is only mandatory for integration, local Canvas, and real E2E tests.

Before modifying:

```bash
git status
git branch --show-current
```

Work on a focused branch; do not mix massive refactors with a functional fix without a verifiable justification.

## 2. Design boundaries

- Recommended maximum of 300 lines per file.
- Recommended maximum of 100 lines per function.
- One primary responsibility per module/class.
- External dependencies behind adapters or injectable services.
- Thin controllers: validate/adapt HTTP and delegate use cases.
- Repositories encapsulate SQL/persistence; React components do not know database details.
- Every fixed bug incorporates a proportional regression test.

When a file exceeds a limit due to generated documentation or a declarative table, document the exception; do not compress code to "comply" at the expense of readability.

## 3. Monorepo

The active packages are:

```text
apps/client/    React + Vite
apps/server/    Node.js + Express
```

The `packages/*` pattern is reserved in the workspaces, but there are no active shared packages in the current tree. If one is created, it must have clear boundaries and owners.

Run scripts from the root so npm resolves workspaces and the lockfile uniformly.

## 4. Per-platform logic

- Windows-only code: adapter/class `Windows…` or `Win…`.
- Linux-only code: `Linux…`.
- WSL specific differences: `Wsl…` or explicit WSL policy.
- macOS-only code: `Mac…`.
- Shared logic must not have a system prefix.

Probes observe and report; installers mutate after consent. Do not mix Docker Desktop downloads, APT, UAC, `sudo`, Gatekeeper, or `.wslconfig` in a single conditional file.

## 5. Local code and production

The `.local.js`/`_local.js` suffixes indicate a versioned adapter for development, not a private file. They must never contain secrets.

- Share domain and use cases between local/production.
- Substitute infrastructure via composition roots/adapters.
- Local bypass requires explicit guards and tests demonstrating that production rejects it.
- Do not create a second complete implementation just to change the data source.

## 6. Old `scripts/` directory

The `scripts/` directory has been removed and its content redistributed. Operational and diagnostic commands now reside in `apps/installer/src/commands/` and `apps/server/bin/`. New business logic, platform detection, or migrations must be placed in the corresponding module.


## 7. Development

```bash
npm run server   # backend; manual restart when changing code
npm run dev      # Vite frontend with HMR
```

For full Canvas:

```bash
npm start
# select option 3
```

Do not run the Linux project from `/mnt/c` or `/mnt/d` if using Docker Engine inside WSL2; clone into `/home/<user>/...`.

## 8. Required tests

Baseline for any change:

```bash
npx --yes npm@11.8.0 run lint
npx --yes npm@11.8.0 test
npx --yes npm@11.8.0 run build
```

If you change the client:

```bash
npx playwright install chromium
npx --yes npm@11.8.0 run test:client
```

If you change persistence/integration:

```bash
npx --yes npm@11.8.0 run test:integration
```

If you change setup/platform, add tests with injected dependencies and validate at least the affected system. A Docker mock does not prove a real installation.

See [TESTING.md](TESTING.md) for the complete matrix.

## 9. Database

- Add an incremental migration in `packages/plugin-database/migrations/`; do not rewrite an already applied migration.
- Design resumable migrations when reasonable.
- Do not include real institutional data in seeds.
- Destructive changes require backup, rollback strategy, and explicit approval.
- Update repositories, tests, and schema documentation in the same change.

## 10. Security

- Do not commit `.env`, tokens, private keys, credentials, or dumps.
- Do not log authorization headers, LTI cookies, or prompts with full personal data.
- Use structured arguments when launching processes; avoid `shell: true` and input concatenation.
- Do not run remote scripts without version/verification.
- Do not kill external processes or delete folders/volumes as automatic recovery.
- Run Gitleaks according to [GITLEAKS.md](GITLEAKS.md).

Vulnerabilities are reported according to [SECURITY.md](SECURITY.md), not through public issues with exploitable details.

## 11. Documentation

Update documentation when changing any of these contracts:

- commands and versions;
- environment variables;
- ports/URLs;
- orchestrator modes;
- monorepo structure;
- LTI scopes or endpoints;
- platform support;
- test or production status.

Do not link private reports or promise behavior that has no reproducible evidence.

## 12. Pull request checklist

- [ ] Small scope and description of the problem/decision.
- [ ] No unrelated changes or generated artifacts.
- [ ] Files/functions within limits or justified exception.
- [ ] Regression test added or explicit reason.
- [ ] Lint, tests, and build executed with reported result.
- [ ] Migration, security, and rollback risks described.
- [ ] Documentation and examples updated.
- [ ] Secret scan without new findings.
