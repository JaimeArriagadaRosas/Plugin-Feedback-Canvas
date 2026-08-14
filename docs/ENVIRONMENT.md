# Reproducible Execution Environment

## 1. Versions

| Component | Current policy |
|---|---|
| Node.js | `^20.19.0 || >=22.12.0` |
| npm | exactly `11.8.0` to reproduce the lockfile |
| CI | Node `22.12.0` + npm `11.8.0` |
| Server image | Node `24-alpine` |
| React | `18.2.0` |
| Vite | `8.1.5` |
| Plugin PostgreSQL | `postgres:15-alpine` image |
| Gotenberg | major image `gotenberg/gotenberg:8` |
| Local Canvas | `release/2026-05-20.143` |

Reproducible installation:

```bash
npx --yes npm@11.8.0 ci
```

Do not use `npm install` in CI, images, preboot, or to "fix" a lockfile. The ranges of some development dependencies are still resolved using `package-lock.json`.

## 2. Boot modes

| Variable | Value | Meaning |
|---|---:|---|
| `STARTUP_MODE` | `1` | LTI runtime for external Canvas |
| `STARTUP_MODE` | `2` | deployment/registration assistant |
| `STARTUP_MODE` | `3` | Docker local Canvas |
| `STARTUP_MODE` | `4` | black-box validations |
| `NON_INTERACTIVE` | `true` | uses `STARTUP_MODE` without asking in the menu |

Temporary example:

```bash
NON_INTERACTIVE=true STARTUP_MODE=3 npm start
```

## 3. `.env` File

The preflight preserves `.env` if it already exists. If it does not exist, it uses `.env.example` when available; in the current tree, there is also a fallback template in `EnvironmentDetector` to avoid blocking local setup.

`.env` is generated and is ignored by Git. It is not a source of production configuration nor should it be copied between teams without reviewing each value.

## 4. Main variables

### Database

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | full string when the environment provides it |
| `DB_HOST`, `DB_PORT` | PostgreSQL host/port |
| `DB_USER`, `DB_PASSWORD`, `DB_NAME` | plugin credentials and database |
| `AUTO_MIGRATE` | runs migrations on startup only if `true` |

### Canvas and LTI

| Variable | Purpose |
|---|---|
| `CANVAS_BASE_URL` | public origin/base of Canvas |
| `CANVAS_API_HOST` | hostname/host:port used by `CanvasClient` when building REST API URLs |
| `CANVAS_ACCESS_TOKEN` | API token for flows that require it |
| `CANVAS_COURSE_ID` | selected local or test course |
| `LTI_CLIENT_ID` | Developer Key client ID |
| `LTI_CLIENT_SECRET` | main LTI secret for OAuth2 |
| `CANVAS_CLIENT_SECRET` | alias of `LTI_CLIENT_SECRET` accepted by `CanvasOAuthController` and `CanvasTokenManager` |
| `LTI_DEPLOYMENT_IDS` | permitted deployments |
| `LTI_ISSUER`, `LTI_OIDC_URL` | platform and OIDC endpoint |
| `LTI_REDIRECT_URI` | registered callback |
| `LTI_KEY_ID` | plugin key identifier |

### Application and services

| Variable | Purpose |
|---|---|
| `PORT` | backend port; usual value 3000 |
| `FRONTEND_URL`, `FRONTEND_DIST` | UI origin and served build |
| `GOTENBERG_URL` | document conversion service |
| `REDIS_URL` | Redis when the environment/service uses it |
| `LOG_LEVEL`, `LOG_TO_FILE` | logs level and destination |
| `ENCRYPTION_KEY` | encryption of persisted sensitive values |
| `DEV_TOKEN_SECRET` | signature of local development tokens |

### Local development

| Variable | Rule |
|---|---|
| `USE_LOCAL_DATA` | `false` outside development |
| `VITE_USE_LOCAL_DATA` | `false` in real builds/deployments |
| `ENABLE_TEST_AUTH_BYPASS` | forbidden in production |
| `CANVAS_ADMIN_PASS`, `CANVAS_TEACHER_PASS`, `CANVAS_STUDENT_PASS` | local fixtures only |

AI provider keys are also secrets. Gemini supports `GEMINI_API_KEY`; other providers are configured via the administrative layer/encrypted persistence depending on the current flow. Do not invent a generic variable without checking its consumption in code.

## 5. Generated files and state

| Path | Content | Version |
|---|---|---|
| `.env` | local configuration/secrets | no |
| `.setup_complete` | fast boot marker | no |
| `tmp/canvas_local_users.json` | exported synthetic profiles and tokens | no |
| `logs/` | operational logs | no |
| `dist/` | frontend build | no |
| `node_modules/` | installed dependencies | no |
| `canvas-lms-master/` | external Canvas checkout | no, lives outside the repo |

Code files `*.local.js` are versioned: they express local adapters, not personal secrets.

## 6. Containers and memory

- Windows: Docker Desktop/WSL2.
- Linux: Docker Engine + Compose V2; rootless is recommended.
- WSL2: Integrated Docker Desktop or native Engine, not both implicitly.
- macOS: OrbStack or Docker Desktop.

The setup calculates Canvas limits from the memory visible to Docker. Approximately 8 GiB available is the practical minimum of the local flow; a build may require more CPU, disk, and time even if the limits are conservative.

## 7. Production

- Inject secrets from the deployment system or secrets manager.
- Use new, rotatable passwords/keys distinct from fixtures.
- Keep `NODE_ENV=production`, local bypass disabled, and coherent HTTPS public origins.
- Run migrations as a controlled stage and with backup/rollback.
- Do not include `.env`, private keys, or local certificates in the image.
- Validate that `config/lti_placement.json` is generated for the real domain; the versioned file contains localhost endpoints.

## 8. Verification

```bash
node --version
npx --yes npm@11.8.0 --version
docker info
docker compose version
npx --yes npm@11.8.0 run lint
npx --yes npm@11.8.0 test
npx --yes npm@11.8.0 run build
```
