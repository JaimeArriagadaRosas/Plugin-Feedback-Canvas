# Diagnóstico y resolución de problemas

La regla principal es conservar el primer error, confirmar la carpeta y observar antes de modificar. No use `chmod -R 777`, `git reset --hard`, terminación masiva de procesos ni limpieza global de Docker como respuesta inicial.

## Diagnóstico base

Ejecute desde la raíz del plugin:

```bash
pwd
node --version
npm --version
git status
docker context show
docker info
docker compose version
```

Guarde el comando, la salida completa y el sistema operativo. La existencia de `docker --version` solo demuestra que hay un cliente; `docker info` prueba la conexión al daemon.

## `cd: No such file or directory`

La carpeta no existe en esa ruta, aún no fue clonada/copiada o hay diferencias de mayúsculas.

```bash
pwd
ls -la
ls -la /ruta/del/directorio/padre
```

Las rutas con espacios deben ir entre comillas. En WSL, `D:\Descargas\Proyecto Plugin feedback` se ve como `/mnt/d/Descargas/Proyecto Plugin feedback`.

## `wsl: command not found` dentro de Ubuntu

Ya está dentro de Linux. `wsl` administra distribuciones desde PowerShell/CMD de Windows. No instale un paquete Linux llamado `wsl` para corregirlo.

Si necesita apagar WSL completamente, abra PowerShell en Windows:

```powershell
wsl --shutdown
```

## `node version` busca un módulo

Use una opción con guiones:

```bash
node --version
node -v
```

Sin `--`, Node interpreta `version` como el nombre de un archivo JavaScript.

## npm o lockfile incompatibles

El proyecto fija npm 11.8.0. Desde la raíz confirmada:

```bash
npx --yes npm@11.8.0 ci
```

No cambie a `npm install` ni borre el lockfile. Si falla, conserve las primeras líneas del error y compruebe que Node satisface `^20.19.0 || >=22.12.0`.

## PowerShell bloquea `npm.ps1`

Use el ejecutable de Windows:

```powershell
npm.cmd start
npx.cmd --yes npm@11.8.0 ci
```

Como alternativa, una política solo para la sesión puede autorizarse según las normas del equipo:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
```

No cambie la política de toda la máquina sin necesidad.

## Docker no aparece en WSL2

Elija una arquitectura:

1. Docker Desktop con WSL Integration habilitado para esa distribución; o
2. Docker Engine nativo dentro de Ubuntu.

Compruebe origen y contexto:

```bash
which docker
docker context ls
docker context show
docker info
```

Una ruta bajo `/mnt/c/Program Files/Docker/...` es el cliente de Windows. No demuestra que exista un daemon Linux nativo.

## `EACCES: permission denied` en volúmenes de Docker

El contenedor intentó acceder o modificar un archivo pero el sistema de archivos anfitrión le denegó el acceso. Esto ocurre típicamente cuando un archivo o directorio fue creado previamente usando privilegios elevados (ej. `sudo`), quedando bajo propiedad de `root` (UID 0), mientras que el contenedor se ejecuta con un usuario normal (por defecto, `docker` UID 9999).

```bash
ls -la /ruta/al/archivo_o_directorio
```

Si el propietario es `root`, puede corregirlo cambiando la propiedad al usuario correcto o borrando el archivo si es autogenerado (ej. `development.log` o carpetas temporales). Nunca use `sudo` rutinariamente para ejecutar `npm start` ni herramientas del proyecto.

## `Cannot connect to the Docker daemon`

En rootless:

```bash
systemctl --user status docker.service
docker context show
docker info
```

En Docker Desktop, compruebe que la aplicación esté iniciada y que la integración de la distribución esté activa. No instale un segundo daemon antes de saber qué contexto/socket usa la terminal.

## Permiso denegado en `/var/run/docker.sock`

La terminal intenta usar el daemon del sistema sin permisos. El grupo `docker` concede acceso equivalente a root. La opción preferida del instalador Linux es rootless.

```bash
id
docker context ls
docker context show
docker info
```

Si se autorizó expresamente un cambio de grupo, se necesita una sesión nueva; en WSL puede requerir `wsl --shutdown` desde Windows. No combine `sudo docker` con un contexto rootless como solución permanente.

## Avisos `No cpuset/io.weight/io.max support`

Pueden aparecer con Docker rootless sobre WSL2. Indican que ciertos controles finos de cgroups/I/O no están disponibles; no significan por sí solos que Docker esté roto. Evalúe el fallo real del contenedor y la memoria disponible.

## Proyecto en `/mnt/c` o `/mnt/d` lento o con permisos extraños

Copie/clone el proyecto al filesystem Linux:

```text
/home/<usuario>/plugin-feedback/Plugin-Feedback
```

Los builds, `node_modules`, Bundler y bind mounts son más fiables allí. Use las rutas `/mnt/...` para intercambio ocasional, no para el ciclo intensivo de herramientas Linux.

## Puerto ocupado

Identifique primero al propietario.

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

Repita para 5173, 8080 o 8443. No ejecute `taskkill /F` o `kill -9` hasta confirmar que el proceso pertenece a este proyecto. El orquestador solo debe cerrar sus propios procesos hijo.

## `canvas.docker` no resuelve

Compruebe:

```bash
getent hosts canvas.docker
npm run setup:hosts
```

El segundo comando modifica el archivo hosts y requiere autorización. Para revertir:

```bash
npm run setup:hosts -- --remove
```

## Certificado HTTPS no confiable

Los certificados locales no son certificados públicos. Visite primero los endpoints locales y confíe únicamente en la CA/certificado generado para desarrollo. Nunca desactive globalmente la validación TLS ni establezca permanentemente `NODE_TLS_REJECT_UNAUTHORIZED=0`.

Compruebe:

```bash
npm run verify:https
curl -kI https://localhost:3000/health
```

`-k` es solo diagnóstico local; no debe usarse para validar producción.

## Canvas no responde después del setup

Desde `canvas-lms-master`:

```bash
docker compose ps
docker compose logs --tail=150 web
docker compose logs --tail=150 jobs
docker compose logs --tail=100 postgres
curl -I http://localhost:8080/login
```

Busque el primer contenedor `Exited`, `Unhealthy` o error de migración. No borre volúmenes antes de guardar logs y confirmar que los datos son descartables.

## HTTP 500 Persistente / Mismatch UID en Rootless

Si el instalador o la aplicación detectan fallos recurrentes de permisos (`EACCES`, `HTTP 500` persistente durante el arranque):

1. **Usa `npm run diagnose`**: Revisa la salida detallada. Verificará si tu Docker está en modo rootless/userns-remap y confirmará si el mapeo UID entre el host y el contenedor está roto.
2. En entornos **rootless**, el daemon mapea los usuarios. Si los logs muestran "Permission denied" en directorios clave, puede ser que el usuario de la imagen (9999) no tenga privilegios en el bind mount `.:/usr/src/app`.
3. Evita reconfigurar el `USER_ID` a mano. La comprobación temprana (`CanvasWorkspaceProbe`) te indicará el directorio exacto que rechaza la escritura.

## Testcontainers no encuentra runtime

```bash
docker info
docker run --rm hello-world
npm run test:integration
```

En rootless, asegúrese de ejecutar la prueba con el mismo usuario/contexto que responde a `docker info`.

## Build completa con advertencia de chunks grandes

Vite puede advertir por bundles como `exceljs` o el visor PDF. Si `npm run build` termina con código 0, es una advertencia de rendimiento, no un fallo. Regístrela como deuda y mida antes de cambiar la división de chunks.

## Limpieza segura

Primero inspeccione:

```bash
docker ps -a
docker volume ls
docker system df
```

`docker compose down` afecta el stack del compose actual. `docker compose down -v`, `docker system prune -a --volumes`, `git clean -fdx` y `rm -rf` son destructivos; requieren un objetivo exacto, confirmación y respaldo cuando corresponda.
