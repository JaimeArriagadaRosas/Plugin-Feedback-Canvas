# Multi-platform Installation

This guide prepares the repository and its container runtime. The installer is written in Node.js, so Node and Git are prerequisites; the setup can help with Docker, but cannot start without its own runtime.

## 1. Open a terminal

### Windows

Open **PowerShell**, **Windows Terminal**, or **Command Prompt** from the Start menu. If you use PowerShell and `npm.ps1` is blocked, prefer `npm.cmd` or change only the session policy according to your organization's rules.

### Ubuntu on WSL2

Directly open the **Ubuntu** application. You will already be inside Linux; do not run `wsl -d Ubuntu` there. The commands `wsl --status`, `wsl --list --verbose`, and `wsl --shutdown` belong to Windows PowerShell/CMD.

### Native Linux

Open your distribution's terminal; in many desktops, `Ctrl+Alt+T` is used.

### macOS

Open **Terminal** from Spotlight (`Cmd+Space`) or Applications > Utilities.

## 2. Minimum syntax

```bash
pwd                         # shows the current folder
ls -la                      # lists files, including hidden ones
cd "path with spaces"       # enters a folder
cd ..                       # goes up one level
node --version              # --version is an option; "node version" is incorrect
```

In Bash, `~` represents `/home/<user>`. Linux is case-sensitive and uses `/` as a separator.

## 3. Required versions

| Component | Repository requirement | Used reference |
|---|---|---|
| Node.js | `^20.19.0` or `>=22.12.0` | CI: 22.12; image: 24 |
| npm | `11.8.0` | pinned in `packageManager` |
| Git | modern version with TLS support | required to clone Canvas |
| Docker Compose | V2 (`docker compose`) | legacy `docker-compose` binary not supported as sole interface |

Check:

```bash
node --version
npm --version
git --version
```

The global version of npm may differ. Use the pinned manager when installing:

```bash
npx --yes npm@11.8.0 ci
```

`npm ci` deletes and rebuilds `node_modules` from `package-lock.json`. Do not use `npm install` to repair a clean installation, because it may recalculate the lockfile.

### What the npm installation creates

- `package.json` declares workspaces, scripts, and direct dependencies.
- `package-lock.json` pins the resolved tree and its integrities.
- `node_modules/` contains the downloaded libraries and local executables like Vite, Vitest, and ESLint.

`node_modules` is a generated, large, and non-versioned artifact. It is not edited manually. It can be rebuilt with `npm ci`, but deleting it unnecessarily loses cache and forces downloading everything again.

## 4. Obtain the repository

```bash
git clone https://github.com/JaimeArriagadaRosas/Plugin-Feedback-Canvas.git
cd Plugin-Feedback-Canvas
npx --yes npm@11.8.0 ci
```

If working from a specific branch:

```bash
git clone --branch fix/linux-native-setup-hardening --single-branch \
  https://github.com/JaimeArriagadaRosas/Plugin-Feedback-Canvas.git
```

Before running any setup:

```bash
pwd
git status
git branch --show-current
```

## 5. Container runtime

Docker is required for local Canvas, integration PostgreSQL, Gotenberg, and Testcontainers. It is not required for linting or building the client.

| Platform | Recommended runtime | Project automation |
|---|---|---|
| Windows | Docker Desktop with WSL2 backend | `WinDockerInstaller` adapter |
| Ubuntu/WSL2 | Native rootless Docker Engine for Linux matrix; alternatively Docker Desktop integration | `Linux…` adapters; do not mix both without choosing context/socket |
| Linux APT | Docker CE from official repository and rootless | configures keyring/official repository after `sudo` consent |
| Linux DNF/Pacman | Distribution packages and rootless when available | specific package manager commands |
| macOS | OrbStack or Docker Desktop | `MacDockerInstaller` adapter; requires Gatekeeper interaction |

The preflight distinguishes four states: missing CLI, stopped daemon, permission denied, and active daemon. Finding the `docker` executable does not prove an accessible server exists; `docker info` does check it.

## 6. Windows

1. Install compatible Node and Git.
2. Install/open Docker Desktop with WSL2 backend.
3. Check in the terminal where you will run the plugin:

```powershell
docker info
docker compose version
npx --yes npm@11.8.0 ci
```

The Windows installer can download Docker Desktop and prompt UAC. A restart or logoff may be required after installing it.

Do not automatically kill processes occupying a port; identify its owner before acting.

## 7. Native Linux

The current APT flow uses the official Docker CE repository and installs:

- `docker-ce`;
- `docker-ce-cli`;
- `containerd.io`;
- `docker-buildx-plugin`;
- `docker-compose-plugin`.

Before modifying the system, the setup shows the action and `sudo` requests authorization. If it detects conflicting packages (`docker.io`, `podman-docker`, `containerd`, etc.), it stops instead of deleting them silently.

Afterwards, it recommends rootless Docker. This mode avoids giving the user access equivalent to `root` via the `docker` group. If rootless fails, adding the user to the group is a separate alternative that requires explicit confirmation and a new session.

Final check:

```bash
docker context show
docker info
docker compose version
```

In rootless, `docker info` must include `rootless` under `Security Options`.

## 8. Ubuntu on WSL2

There are two valid architectures, but one must be chosen:

### Native Engine inside Ubuntu

This is the mode used to test the Linux branch. Docker and its data live inside Ubuntu; the usual context is `rootless` and the socket is under `/run/user/<uid>/docker.sock`.

Keep the project on ext4:

```text
/home/<user>/projects/Plugin-Feedback
```

Do not run intensive builds from `/mnt/c/...` or `/mnt/d/...`: they are mounted Windows disks and can yield worse performance and permission differences with bind mounts.

### Docker Desktop Integration

Enable the distribution in Docker Desktop > Settings > Resources > WSL Integration and check `docker info` from Ubuntu. In this mode, the daemon is managed by Docker Desktop.

Do not enable both implicitly. Check:

```bash
which docker
docker context ls
docker context show
docker info
```

A CLI path under `/mnt/c/Program Files/Docker/...` corresponds to Windows interoperability, not a native Linux installation.

## 9. macOS

The setup allows OrbStack or Docker Desktop. Homebrew, image mounting, and Gatekeeper can open windows and ask for confirmation. Check when finished:

```bash
docker info
docker compose version
```

## 10. Folder layout

Mode 3 calculates `canvas-lms-master` as a sibling folder of the plugin:

```text
workspace/
├── Plugin-Feedback/
└── canvas-lms-master/
```

The setup pins Canvas to `release/2026-05-20.143`. If the destination exists but does not look like a recognizable installation, it stops: it does not delete or overwrite it automatically.

## 11. Start

```bash
npm start
```

Select option 3 for local Canvas, or use:

```bash
NON_INTERACTIVE=true STARTUP_MODE=3 npm start
```

The first execution may download several gigabytes and compile assets over a prolonged period. Keep the console open and do not start two setups on the same folder.

The difference from a repeat run is explained by the initial work:

1. downloading the checkout and base Canvas images;
2. installing Ruby gems and JavaScript packages;
3. PostgreSQL migrations and initialization;
4. compiling translations and Canvas assets;
5. creating volumes, seeds, and local LTI configuration.

Subsequent executions reuse checkout, images, volumes, and resumable markers. Even so, the fast boot re-checks the runtime; it does not guarantee "under a minute" nor should it hide a degraded container.

## 12. Privileged actions

The setup may request permission to install packages, enable services, configure rootless, or modify the hosts file. It must not:

- run installers for another operating system;
- delete conflicting packages without explicit decision;
- add users to the `docker` group hiddenly;
- delete volumes, Canvas folders, or foreign processes;
- run arbitrary remote scripts as a substitute for the versioned installer.

For installation errors see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## 13. Official references

- [Microsoft: what is WSL](https://learn.microsoft.com/windows/wsl/about)
- [Microsoft: WSL commands](https://learn.microsoft.com/windows/wsl/basic-commands)
- [Microsoft: working across Windows/Linux filesystems](https://learn.microsoft.com/windows/wsl/filesystems)
- [Docker Engine: installation](https://docs.docker.com/engine/install/)
- [Docker: rootless mode](https://docs.docker.com/engine/security/rootless/)
- [npm: clean install with `npm ci`](https://docs.npmjs.com/cli/v11/commands/npm-ci/)
