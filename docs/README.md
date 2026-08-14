# Feedback Plugin for Canvas LMS

Feedback Plugin is an LTI 1.3 web application that integrates with Canvas LMS to generate, review, approve, and send academic feedback. The teacher retains control of the flow: they can use templates, context variables, and AI providers, but they review and approve the feedback before it reaches the student.

> [!IMPORTANT]
> The project is in pre-production validation. The local mode allows developing and testing the plugin with a simulated Canvas instance, but it does not certify an institutional deployment nor production by itself.

## Index

- [Description and related documentation](#description-and-related-documentation)
- [Opening a console or terminal](#opening-a-console-or-terminal)
- [Required programs](#required-programs)
- [Folder organization](#folder-organization)
- [Step-by-step installation](#step-by-step-installation)
- [What npm, npm ci, and node_modules do](#what-npm-npm-ci-and-node_modules-do)
- [Environment variables (.env)](#environment-variables-env)
- [Compilation and execution](#compilation-and-execution)
- [The option 3 installation layer](#the-option-3-installation-layer)
- [Why the first execution takes time](#why-the-first-execution-takes-time)
- [Manual execution for development](#manual-execution-for-development)
- [Local test accounts](#local-test-accounts)
- [Testing and troubleshooting](#testing-and-troubleshooting)

## Description and related documentation

The repository is a monorepo: it contains the React client, the Node.js server, the interactive installer, shared contracts, and data access. Canvas LMS does **not** belong to the plugin's domain: the local mode prepares it as a sibling folder to simulate the real platform.

This guide teaches the first use. Specialized topics remain in separate documents to avoid duplicating them:

| Need | Document |
|---|---|
| Install on Windows, Linux, WSL2, or macOS | [Multi-platform installation](INSTALLATION.md) |
| Understand modes and the daily Canvas cycle | [Local development](LOCAL_DEVELOPMENT.md) |
| Variables, versions, secrets, and resources | [Execution environment](ENVIRONMENT.md) |
| Execute tests | [Testing strategy](TESTING.md) |
| Diagnose errors | [Troubleshooting](TROUBLESHOOTING.md) |
| Contribute to the monorepo | [Contribution](CONTRIBUTING.md) |
| Institutional LTI deployment | [Deployment](DEPLOYMENT.md) |

## Opening a console or terminal

The console is a text window from which commands are executed. All commands in this document are typed after the prompt and confirmed with `Enter`.

### Windows

> [!TIP]
> **Performance:** If startup or compilation is very slow on native Windows, it is strongly recommended to add the project folder to the **Windows Defender exclusions**. The real-time scanning of thousands of small files (like those in `node_modules` or Docker containers) drastically penalizes the disk.
> You can do this by opening PowerShell as Administrator and running:
> `Add-MpPreference -ExclusionPath "C:\Path\To\Your\Project"`

Open **Windows Terminal**, **PowerShell**, or **Command Prompt (CMD)** from the Start menu. For a WSL test, directly open the **Ubuntu** application: there you are already inside Linux.

### Ubuntu on WSL2

Open the **Ubuntu** application from the Start menu. Do not type `wsl -d Ubuntu-26.04` inside Ubuntu: `wsl` is a Windows administration command and is used from PowerShell or CMD.

### Native Linux and macOS

In Linux, you normally open the terminal with `Ctrl+Alt+T`. In macOS, open **Terminal** from Spotlight with `Cmd+Space`.

### Minimum syntax

```bash
pwd                         # shows the current folder
ls -la                      # lists files, including hidden ones
cd folder                   # enters a folder
cd ..                       # goes up one level
cd "path with spaces"       # enters a path containing spaces
node --version              # shows the version; "node version" is incorrect
```

In Linux and macOS, `~` means the user's home folder. Linux is case-sensitive and uses `/` as the path separator.

## Required programs

Node.js and Git are external prerequisites: the project is written in Node.js, so `npm start` needs a functional Node before being able to start the installer. Docker is necessary only for local Canvas, integration PostgreSQL, Gotenberg, and tests with Testcontainers.

| Component | Requirement | What it is used for |
|---|---|---|
| Git | modern version with TLS | clone the plugin and Canvas LMS |
| Node.js | `^20.19.0` or `>=22.12.0` | run the installer, backend, and tools |
| npm | `11.8.0` for reproducible installations | respect `package-lock.json` |
| Docker Compose | Compose V2: `docker compose` | Canvas and local services |
| Memory and disk | at least 8 GiB available for Canvas | images, assets, and local databases |

Check any installation with:

```bash
node --version
npm --version
git --version
docker info
docker compose version
```

### Windows

Install a compatible LTS version of [Node.js](https://nodejs.org/) and Git. For mode 3, install and open Docker Desktop with the WSL2 backend. The installer can guide or automate part of Docker, but Node.js continues to be a user requirement.

### Ubuntu, WSL2, and Native Linux

In Ubuntu, WSL2, and native Linux, install Node for that Linux environment. A recommended option is NVM: it manages Node versions per user and does not require `sudo`.

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.6/install.sh | bash
source ~/.bashrc
nvm install 22
nvm alias default 22
node --version
command -v node
```

The last line should show a path under `~/.nvm/`. If you open a new terminal, NVM will load the default version. See the [official NVM instructions](https://github.com/nvm-sh/nvm#installing-and-updating) if your shell does not load `~/.bashrc`.

When selecting mode 3 in Ubuntu, the project may ask for `sudo` confirmation and password to install Docker Engine, Docker Compose, rootless Docker, or `mkcert` when they are missing.

### macOS

Install Node LTS and Git with their official installers or the package manager used by your computer. For local Canvas, use Docker Desktop or OrbStack. Certificate automation in macOS still requires additional validation; see [Multi-platform installation](INSTALLATION.md).

## Folder organization

In Windows, you can save a copy of the repository wherever you prefer. In Linux/WSL2, it is recommended to work from the user's home folder, for example, `/home/<user>/projects`. This way, dependencies, permissions, and Docker mounts remain in the same Linux environment, and builds are usually faster.

Mode 3 prepares Canvas as a sibling folder:

```text
projects/
├── Plugin-Feedback-Canvas/  # this repository
└── canvas-lms-master/       # created by option 3; external dependency
```

Do not move or mix plugin code inside `canvas-lms-master`. Also, do not commit Canvas, `node_modules`, certificates, `.env` files, tokens, or Docker volumes to the repository.

## Step-by-step installation

### 1. Clone the project

From Ubuntu/WSL2, clone the stable version of the project from `main`:

```bash
mkdir -p ~/projects
cd ~/projects
git clone --branch main --single-branch \
  https://github.com/JaimeArriagadaRosas/Plugin-Feedback-Canvas.git
cd ~/projects/Plugin-Feedback-Canvas
```

Always check where you are before starting:

```bash
pwd
git branch --show-current
git status
```

### 2. Install dependencies and start

With compatible native Node already installed, the usual command is:

```bash
npm start
```

If `node_modules` does not exist or is incomplete, the pre-boot automatically installs the dependencies using `npx --yes npm@11.8.0 ci`. Therefore, for a normal first execution, you do not need to manually run `npm ci` or `npm install` beforehand.

When the menu appears, select:

```text
[3] Ejecutar localmente Canvas LMS (Entorno Docker de desarrollo)
```

Keep the console open while Canvas is installing or running. To stop the processes initiated by the orchestrator, use `Ctrl+C` only once and wait for the orderly shutdown.

### 3. Manual dependency installation, only when needed

To explicitly rebuild already diagnosed dependencies, use the pinned version of npm:

```bash
npx --yes npm@11.8.0 ci --no-fund --no-audit
```

`package-lock.json` contains the verified versions of the project; keep it when rebuilding dependencies.

## What npm, npm ci, and node_modules do

`package.json` is the declared list of project tools and scripts. `package-lock.json` pins the exact versions and their integrities. `node_modules/` is the generated folder containing downloaded libraries and local executables like Vite, Vitest, and ESLint.

| Command | Correct use in this repository | Effect |
|---|---|---|
| `npm start` | normal start | runs the orchestrator and repairs missing dependencies with pinned npm |
| `npx --yes npm@11.8.0 ci` | controlled manual rebuild | recreates `node_modules` exactly from the lockfile |
| `npm install` | intentionally add or update a dependency | may recalculate the lockfile; not the routine repair |

`node_modules` can take up hundreds of MBs. It is not versioned or manually edited. Deleting it forces downloading and installing again; it does not delete the source code, but it does prolong the next startup.

## Environment variables (.env)

Locally, the orchestrator creates `.env` from its secure template when it does not exist and generates missing development keys. To run option 3, you normally do not need to write secrets manually.

You can edit `.env` to configure AI providers, ports, or local test credentials, but you must never commit it to Git. Also, do not copy Canvas tokens, private LTI keys, local certificates, or synthetic accounts to production. The list of variables and their scope is in [Execution environment](ENVIRONMENT.md).

> [!WARNING]
> If local keys are regenerated while volumes with previous data exist, some encrypted data may become unreadable. The installer does not automatically delete volumes: back up and explicitly decide on a reset.

## Compilation and execution

`npm start` opens an interactive console with four modes:

| Option | Purpose |
|---:|---|
| 1 | LTI 1.3 runtime for an external Canvas |
| 2 | LTI registration and deployment assistant |
| 3 | Local Canvas LMS in Docker: main mode for development and QA |
| 4 | Black-box project validations |

For local Canvas without answering the menu:

```bash
NON_INTERACTIVE=true STARTUP_MODE=3 npm start
```

Upon successful completion, the usual addresses are:

| Service | Address |
|---|---|
| Plugin / backend | `https://localhost:3000` |
| Vite frontend | `https://localhost:5173` |
| Canvas via TLS proxy | `https://localhost:8443` |
| Internal HTTP Canvas | `http://localhost:8080` |
| Local Gotenberg | `http://localhost:3001` |

The browser opens with the user's default browser. In WSL, Canvas and Docker live inside Ubuntu, but the browser and its certificate store belong to Windows.

## The option 3 installation layer

Option 3 doesn't just "open a window". It checks and prepares components in a resumable way:

1. Verifies Node, npm, Git, Docker, Compose, memory, ports, and permissions.
2. Creates or preserves `.env`, local keys, and minimal configuration.
3. Clones Canvas LMS as a sibling folder, without incorporating it into the monorepo.
4. Starts the Canvas base services and prepares its Docker configuration.
5. Installs Ruby gems, Yarn packages, translations, and compiles Canvas assets.
6. Initializes PostgreSQL, Redis, and Canvas `web` and `jobs` containers.
7. Inserts synthetic data, installs the local LTI configuration, and synchronizes users.
8. Starts the plugin's PostgreSQL and Gotenberg, applies its migrations, and starts the backend.
9. Generates local development HTTPS certificates, starts the TLS proxy, and opens Canvas when it responds.

Interactive questions depend on what is missing. On a newly created Ubuntu, confirmations may appear to install Docker and rootless with `sudo`, install `mkcert` and `libnss3-tools`, create a local CA, and — in WSL — trust only the public CA in the Windows user store. A subsequent execution reuses tools, images, assets, and markers like `.assets_built` and `.setup_complete`, so it will ask fewer questions.

## Why the first execution takes time

The first execution usually requires between **20 and 35 minutes**, although it may take longer depending on the network, CPU, memory, disk, and cache availability. Do not close the console just because there is prolonged activity.

The most expensive parts are:

- downloading Docker images and the Canvas checkout, which take several GiBs;
- installing Canvas Ruby gems and JavaScript packages;
- database migrations and seeds;
- compiling translations and Canvas visual assets.

Subsequent executions are usually much faster because they reuse images, containers, volumes, and assets. Even so, the installer re-checks the critical state: a fast execution does not replace a health check.

## Manual execution for development

When dependencies already exist and you don't need to prepare Canvas from scratch, you can start parts separately:

Terminal 1:

```bash
npm run server
```

Terminal 2:

```bash
npm run dev
```

Vite reloads frontend changes. The backend is restarted manually when its code changes. This mode does not create Canvas, Docker, seeds, or the full proxy; use it only if you understand and already have those components ready.

To generate the frontend build:

```bash
npm run build
```

To add the local alias `canvas.docker` to the hosts file:

```bash
npm run setup:hosts
```

That last command modifies the hosts file and requires authorization. To revert it:

```bash
npm run setup:hosts -- --remove
```

## Local test accounts

Mode 3 generates synthetic data exclusive to the local environment:

| Role | User | Initial password |
|---|---|---|
| Administrator | `admin@canvas.local` | `password123` |
| Main teacher | `teacher@canvas.local` | `password123` |
| Additional teachers | `teacher2@canvas.local`, `teacher3@canvas.local` | `password123` |
| Students | `student1@canvas.local` to `student5@canvas.local` | `password123` |

They are public development fixtures. Never use them for staging, production, or real accounts.

## Testing and troubleshooting

Before changing code, confirm where you are and save the complete first error:

```bash
pwd
node --version
npm --version
git status
docker info
docker compose version
```

Frequent problems:

| Symptom | First safe action |
|---|---|
| `node version` looks for a file | use `node --version` |
| Node is not available in Ubuntu/Linux | install Node via NVM and check `node --version` |
| `wsl: command not found` inside Ubuntu | you are already in Linux; run `wsl` only from Windows |
| Docker does not respond | check `docker context show` and `docker info`; don't mix Docker Desktop and rootless without choosing one |
| Port in use | identify the process before stopping it |
| untrusted certificate | run `npm run verify:https`; do not disable TLS globally |
| Canvas takes a long time or does not respond | review `docker compose ps` and the logs of `web`, `jobs`, and `postgres` before deleting data |

For specific commands, safe cleanup, and per-platform cases, see [Troubleshooting](TROUBLESHOOTING.md). For automated suites use:

```bash
npx --yes npm@11.8.0 run lint
npx --yes npm@11.8.0 test
npx --yes npm@11.8.0 run build
```

Do not use `docker system prune -a --volumes`, `git clean -fdx`, `rm -rf`, `kill -9`, or global permission changes as a first diagnosis. Those actions can delete data, caches, or useful work.
