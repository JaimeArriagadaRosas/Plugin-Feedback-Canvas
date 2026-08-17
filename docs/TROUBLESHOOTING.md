# Troubleshooting

The main rule is to preserve the first error, confirm the folder, and observe before modifying. Do not use `chmod -R 777`, `git reset --hard`, massive process termination, or global Docker cleanup as an initial response.

## Baseline diagnostics

Run from the plugin root:

```bash
pwd
node --version
npm --version
git status
docker context show
docker info
docker compose version
```

Save the command, the full output, and the operating system. The existence of `docker --version` only proves there is a client; `docker info` tests the connection to the daemon.

## `cd: No such file or directory`

The folder does not exist at that path, it was not yet cloned/copied, or there are case differences.

```bash
pwd
ls -la
ls -la /path/to/parent/directory
```

Paths with spaces must be enclosed in quotes. In WSL, `D:\Downloads\Proyecto Plugin feedback` looks like `/mnt/d/Downloads/Proyecto Plugin feedback`.

## `wsl: command not found` inside Ubuntu

You are already inside Linux. `wsl` manages distributions from Windows PowerShell/CMD. Do not install a Linux package named `wsl` to fix it.

If you need to shut down WSL completely, open PowerShell in Windows:

```powershell
wsl --shutdown
```

## `node version` looks for a module

Use an option with dashes:

```bash
node --version
node -v
```

Without `--`, Node interprets `version` as the name of a JavaScript file.

## Incompatible npm or lockfile

The project pins npm 11.8.0. From the confirmed root:

```bash
npx --yes npm@11.8.0 ci
```

Do not switch to `npm install` or delete the lockfile. If it fails, keep the first lines of the error and check that Node satisfies `^20.19.0 || >=22.12.0`.

## PowerShell blocks `npm.ps1`

Use the Windows executable:

```powershell
npm.cmd start
npx.cmd --yes npm@11.8.0 ci
```

Alternatively, a session-only policy can be authorized according to the team's rules:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
```

Do not change the machine-wide policy unnecessarily.

## Docker does not appear in WSL2

Choose an architecture:

1. Docker Desktop with WSL Integration enabled for that distribution; or
2. Native Docker Engine inside Ubuntu.

Check origin and context:

```bash
which docker
docker context ls
docker context show
docker info
```

A path under `/mnt/c/Program Files/Docker/...` is the Windows client. It does not prove that a native Linux daemon exists.

## `Cannot connect to the Docker daemon`

In rootless:

```bash
systemctl --user status docker.service
docker context show
docker info
```

In Docker Desktop, check that the application is started and that the distribution integration is active. Do not install a second daemon before knowing which context/socket the terminal uses.

## Permission denied on `/var/run/docker.sock`

The terminal tries to use the system daemon without permissions. The `docker` group grants access equivalent to root. The preferred option of the Linux installer is rootless.

```bash
id
docker context ls
docker context show
docker info
```

If a group change was expressly authorized, a new session is needed; in WSL it may require `wsl --shutdown` from Windows. Do not combine `sudo docker` with a rootless context as a permanent solution.

## `No cpuset/io.weight/io.max support` warnings

They may appear with rootless Docker on WSL2. They indicate that certain fine-grained cgroups/I/O controls are not available; they do not by themselves mean Docker is broken. Evaluate the actual container failure and available memory.

## Project in `/mnt/c` or `/mnt/d` slow or with strange permissions

Copy/clone the project to the Linux filesystem:

```text
/home/<user>/plugin-feedback/Plugin-Feedback
```

Builds, `node_modules`, Bundler, and bind mounts are more reliable there. Use `/mnt/...` paths for occasional exchange, not for the intensive Linux tool cycle.

## Port in use

Identify the owner first.

Windows:

```powershell
netstat -ano | findstr :3000
Get-Process -Id <PID>
```

Linux/macOS:

```bash
ss -ltnp | grep ':3000'
lsof -i :3000
```

Repeat for 5173, 8080, or 8443. Do not run `taskkill /F` or `kill -9` until you confirm the process belongs to this project. The orchestrator should only close its own child processes.

## `canvas.docker` does not resolve

Check:

```bash
getent hosts canvas.docker
npm run setup:hosts
```

The second command modifies the hosts file and requires authorization. To revert:

```bash
npm run setup:hosts -- --remove
```

## Untrusted HTTPS certificate

Local certificates are not public certificates. Visit the local endpoints first and trust only the CA/certificate generated for development. Never globally disable TLS validation or permanently set `NODE_TLS_REJECT_UNAUTHORIZED=0`.

Check:

```bash
npm run verify:https
curl -kI https://localhost:3000/health
```

`-k` is only for local diagnostics; it must not be used to validate production.

## Canvas does not respond after setup

From `canvas-lms-master`:

```bash
docker compose ps
docker compose logs --tail=150 web
docker compose logs --tail=150 jobs
docker compose logs --tail=100 postgres
curl -I http://localhost:8080/login
```

Look for the first container that is `Exited`, `Unhealthy`, or a migration error. Do not delete volumes before saving logs and confirming that the data is disposable.

## Persistent HTTP 500 / UID Mismatch in Rootless

If the installer or the application detect recurring permission failures (`EACCES`, persistent `HTTP 500` during startup):

1. **Use `npm run diagnose`**: Check the detailed output. It will verify if your Docker is in rootless/userns-remap mode and confirm if the UID mapping between the host and the container is broken.
2. In **rootless** environments, the daemon maps the users. If the logs show "Permission denied" in key directories, it may be that the image user (9999) does not have privileges on the bind mount `.:/usr/src/app`.
3. Avoid manually reconfiguring the `USER_ID`. The early check (`CanvasWorkspaceProbe`) will point you to the exact directory that rejects the write.

## Testcontainers cannot find runtime

```bash
docker info
docker run --rm hello-world
npm run test:integration
```

In rootless, make sure to run the test with the same user/context that responds to `docker info`.

## Build completes with large chunks warning

Vite may warn about bundles like `exceljs` or the PDF viewer. If `npm run build` ends with code 0, it is a performance warning, not a failure. Register it as debt and measure before changing the chunk splitting.

## Safe cleanup

First inspect:

```bash
docker ps -a
docker volume ls
docker system df
```

`docker compose down` affects the stack of the current compose. `docker compose down -v`, `docker system prune -a --volumes`, `git clean -fdx`, and `rm -rf` are destructive; they require an exact target, confirmation, and backup when appropriate.
