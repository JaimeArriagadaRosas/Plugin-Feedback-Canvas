# Local Development and Canvas LMS

This guide describes the plugin's local cycle. `canvas-lms-master` is an external simulation dependency: it does not belong to the plugin's domain nor should it be incorporated into the repository.

## 1. Orchestrator modes

Run from the root:

```bash
npm start
```

| Mode | Use | Status |
|---:|---|---|
| 1 | LTI 1.3 runtime for external Canvas | implemented; pending full institutional validation |
| 2 | LTI deployment/registration assistant | implemented; requires token/Developer Key and controlled staging |
| 3 | Local Canvas LMS in Docker | main local development and QA flow |
| 4 | Black box validations | runs current runner and propagates error code |

To automate the choice:

```bash
NON_INTERACTIVE=true STARTUP_MODE=3 npm start
```

Variables only apply to that process. They do not permanently convert the shell to mode 3.

## 2. What mode 3 does

1. Checks Node, npm, platform, Docker, Compose, memory, and ports.
2. Creates/preserves `.env` and generates missing local keys.
3. Clones or installs Canvas `release/2026-05-20.143` as a sibling folder.
4. Prepares Canvas Docker configuration via overrides.
5. Installs Bundler/Yarn and compiles assets with resumable steps.
6. Starts Canvas PostgreSQL, Redis, `web`, and `jobs`.
7. Runs synthetic seeds and installs the local LTI tool.
8. Starts plugin PostgreSQL and Gotenberg, runs migrations, and synchronizes users.
9. Starts backend, frontend, and local TLS proxy.
10. Checks readiness and opens the browser when appropriate.

The `.assets_built` and `.setup_complete` markers speed up repeats, but the preflight re-checks critical dependencies.

## 3. Local resources

| Resource | Address/location |
|---|---|
| Plugin backend | `https://localhost:3000` |
| Vite frontend | `https://localhost:5173` |
| Canvas via TLS proxy | `https://localhost:8443` |
| HTTP Canvas | `http://localhost:8080` |
| Canvas alias in hosts | `canvas.docker -> 127.0.0.1` |
| Plugin Gotenberg | `http://localhost:3001` |
| Exported users/tokens | `tmp/canvas_local_users.json` (generated, not versioned) |

To add the local alias:

```bash
npm run setup:hosts
```

The command modifies the hosts file and requires privileges. To revert:

```bash
npm run setup:hosts -- --remove
```

## 4. Synthetic accounts

| Profile | Email | Initial password |
|---|---|---|
| Administrator | `admin@canvas.local` | `password123` |
| Main teacher | `teacher@canvas.local` | `password123` |
| Additional teacher | `teacher2@canvas.local` | `password123` |
| Additional teacher | `teacher3@canvas.local` | `password123` |
| Juan Pérez | `student1@canvas.local` | `password123` |
| María García | `student2@canvas.local` | `password123` |
| Pedro López | `student3@canvas.local` | `password123` |
| Ana Torres | `student4@canvas.local` | `password123` |
| Carlos Méndez | `student5@canvas.local` | `password123` |

These credentials are hardcoded as public fixtures. Never use them in staging or production.

## 5. Local real LTI and development authentication

The preferred flow starts from local Canvas and executes OIDC/LTI 1.3, including validation of JWT, `state`, `nonce`, roles, and course context.

There is also a local identity provider for rapid development. It only accepts the allowed local mode or `ENABLE_TEST_AUTH_BYPASS=true`, and the `dev-token`s must be signed with `DEV_TOKEN_SECRET`. We do not document manually crafted cookies because an invalid signature must be rejected.

Security rules:

- `ENABLE_TEST_AUTH_BYPASS` must not be active in production.
- `USE_LOCAL_DATA` and `VITE_USE_LOCAL_DATA` must be `false` in production.
- Local roles (`admin`, `teacher`, `student-N`) do not replace a real LTI test.
- Do not copy `.env`, exported tokens, certificates, or seed users to production.

## 6. Separate process development

For rapid UI changes you can run components separately:

Terminal 1:

```bash
npm run server
```

Terminal 2:

```bash
npm run dev
```

The backend script uses `node`, not Nodemon: server changes require restarting it. Vite does offer frontend reloading.

This mode does not prepare Canvas, Docker, seeds, or the full proxy. Use it only when those dependencies already exist or when working with controlled local data.

## 7. Observe the stack

From the Canvas folder:

```bash
docker compose ps
docker compose logs --tail=100 web
docker compose logs --tail=100 jobs
curl -I http://localhost:8080/login
```

A `302` when requesting `/login` is usually a normal Canvas redirect.

From the plugin root:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml ps
```

Do not mix Canvas Compose commands with plugin ones; confirm `pwd` first.

## 8. Stop and resume

`Ctrl+C` requests orderly shutdown of the orchestrator and its child processes. To pause a specific Compose stack:

```bash
docker compose stop
docker compose start
```

`docker compose down` removes containers/networks of the stack. `docker compose down -v` also removes volumes and data: do not run it as routine troubleshooting.

The setup must not automatically delete an unknown Canvas folder or persistent volumes. In case of conflict, back up and explicitly decide the reset.

## 9. Suggested daily flow

```bash
cd /path/to/Plugin-Feedback
git status
docker info
npm start
```

Before committing a change:

```bash
npx --yes npm@11.8.0 run lint
npx --yes npm@11.8.0 test
npx --yes npm@11.8.0 run build
```

See [TESTING.md](TESTING.md) for client, integration, and E2E tests.
