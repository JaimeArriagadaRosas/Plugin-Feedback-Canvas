# LTI 1.3 Deployment and Validation

> [!WARNING]
> This guide describes the validation path; the project is not certified for production. First, use a staging Canvas, synthetic accounts, and disposable/recoverable infrastructure.

## 1. Expected production components

```text
Internet / Canvas
        |
  HTTPS 443 (plugin domain)
        |
Reverse proxy / load balancer
        |
Node app :3000  ----> Gotenberg
        |
Managed or backed-up PostgreSQL
```

The compiled frontend and the API must be presented under a coherent public origin. Canvas will remain a separate site that can load the tool in an iframe; the LTI cookie/session policy must be validated in real browsers.

## 2. Staging prerequisites

- Valid TLS domain and certificate;
- Staging Canvas and authorized administrator;
- Developer Key / LTI 1.3 configuration;
- Test account/subaccount and course;
- PostgreSQL with backup/restore;
- Isolated Gotenberg;
- Secrets manager;
- Centralized logs and metrics;
- Person responsible for rollback and change window.

Do not use `@canvas.local` accounts, `password123`, localhost certificates, or seed tokens.

## 3. Reproducible build

```bash
npx --yes npm@11.8.0 ci
npx --yes npm@11.8.0 run lint
npx --yes npm@11.8.0 test
npx --yes npm@11.8.0 run build
```

The versioned image is built with `apps/server/Dockerfile`, generates `dist`, prunes development dependencies, and runs as the `node` user.

Tag images by commit/release; do not rely on `plugin-feedback-app:latest` as a rollback identifier.

## 4. Migrations

Entry point:

```bash
npm run db:migrate
```

The server only auto-migrates if `AUTO_MIGRATE=true`. The production composition defines a `migrate` service, but it must be validated against a staging copy before using it.

Recommended procedure:

1. backup and restoration test;
2. review pending migrations and expected locks;
3. stop or support writes according to the migration;
4. run migrations once;
5. verify schema and health;
6. deploy compatible app;
7. preserve application/data rollback plan.

## 5. LTI Configuration

The `config/lti_placement.json` file is a **local** template: it contains `localhost`, `course_navigation`, and development endpoints. For staging/production, a JSON with the real domain must be generated/reviewed.

Plugin endpoints:

| Function | Path |
|---|---|
| OIDC initiation | `/api/lti/login` |
| target/callback | `/api/lti/callback` |
| JWKS | `/api/lti/jwks` |

Currently versioned scopes:

- AGS `lineitem`;
- AGS `result.readonly`;
- AGS `score`;
- NRPS `contextmembership.readonly`.

Enable only the necessary scopes and check that the Developer Key configuration, the deployment, and the installation in the account/subaccount match. Canvas recommends configuring LTI 1.3 changes in the associated registration/Developer Key, not editing individual tools as the primary source.

Official documentation: [Canvas LTI 1.3 configuration](https://developerdocs.instructure.com/services/canvas/external-tools/lti/file.lti_dev_key_config) and [External Tools API](https://developerdocs.instructure.com/services/canvas/resources/external_tools).

## 6. Repository assistant

```bash
npm run deploy:lti
# or npm start and option 2
```

The assistant prepares configuration and can use the Canvas API with an authorized token. Before approving its changes:

- confirm URL, account/subaccount, and course;
- review scopes and placement;
- do not paste tokens into recorded terminals or shared logs;
- export/record the previous state for rollback;
- manually verify the created tool.

Mode 2 does not replace administrative review or a real E2E test.

## 7. Runtime

Mode 1 expects LTI configuration and an existing `dist` build:

```bash
npm run build
NON_INTERACTIVE=true STARTUP_MODE=1 npm start
```

Keeping a console open is not a productive strategy. Use a container platform or a supervisor with:

- limited restart and backoff;
- `SIGTERM` signals and drain time;
- independent health/readiness;
- centralized stdout/stderr logs;
- CPU/RAM limits;
- tested rolling or blue/green deployment.

PM2, systemd, Kubernetes, or a managed service are infrastructure decisions; the repository does not currently include a certified PM2 configuration.

## 8. Production Docker Compose

`docker-compose.yml` + `docker-compose.prod.yml` serve as local references for image, DB, Gotenberg, and migration. Before production, it must be externally corrected/validated:

- tagged and immutable images;
- secrets without `CHANGE_ME` defaults;
- TLS/reverse proxy;
- backups and storage;
- port exposure/firewall;
- real healthcheck and startup time;
- limits supported by the chosen runtime;
- PostgreSQL high availability and maintenance;
- observability and alerts.

Validating syntax does not prove operability:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml config -q
```

## 9. Minimum production variables

Review [ENVIRONMENT.md](ENVIRONMENT.md). At a minimum:

- PostgreSQL connection without default credentials;
- `CANVAS_BASE_URL`, issuer/OIDC, and public endpoints;
- LTI client/deployment IDs;
- `ENCRYPTION_KEY` and managed signature material;
- public frontend/backend origin;
- internal Gotenberg;
- AI provider and encrypted credentials;
- local bypass and data disabled.

## 10. Staging validation

For each authorized role:

1. launch from Canvas, not via direct URL;
2. validate `state`, `nonce`, signature, and deployment;
3. verify course/user/role displayed;
4. create/configure template and variables;
5. generate individual and massive feedback;
6. edit, approve, and send;
7. confirm comment and user name in Canvas;
8. check private notes and isolation;
9. validate preferences/notifications and real email;
10. repeat in supported browsers and iframe session.

Additionally, test restarting during jobs, AI/Canvas/Gotenberg degradation, token expiration, migration, backup/restore, and rollback.

## 11. Current blockers

- no production email adapter exists;
- massive generation uses in-memory work and is lost if the process restarts;
- UI/LTI E2E does not yet cover all critical results;
- RF06 writes code to the filesystem;
- final matrix on native Linux and another clean Windows is missing;
- identified historical keys must be considered exposed and rotated;
- productive evidence of load, observability, and recovery is missing.

Until these points are closed, the checklist result is **NO-GO**.
