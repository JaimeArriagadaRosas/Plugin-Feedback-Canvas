# Instalación multiplataforma

Esta guía prepara el repositorio y su runtime de contenedores. El instalador está escrito en Node.js, por lo que Node y Git son prerrequisitos; el setup puede ayudar con Docker, pero no puede arrancar sin su propio runtime.

## 1. Abrir una terminal

### Windows

Abra **PowerShell**, **Windows Terminal** o **Símbolo del sistema** desde Inicio. Si usa PowerShell y `npm.ps1` está bloqueado, prefiera `npm.cmd` o cambie únicamente la política de la sesión conforme a las reglas de su organización.

### Ubuntu sobre WSL2

Abra directamente la aplicación **Ubuntu**. Ya estará dentro de Linux; no ejecute `wsl -d Ubuntu` allí. Los comandos `wsl --status`, `wsl --list --verbose` y `wsl --shutdown` pertenecen a PowerShell/CMD de Windows.

### Linux nativo

Abra la terminal de su distribución; en muchos escritorios se usa `Ctrl+Alt+T`.

### macOS

Abra **Terminal** desde Spotlight (`Cmd+Espacio`) o Aplicaciones > Utilidades.

## 2. Sintaxis mínima

```bash
pwd                         # muestra la carpeta actual
ls -la                      # lista archivos, incluidos los ocultos
cd "ruta con espacios"      # entra a una carpeta
cd ..                       # sube un nivel
node --version              # --version es una opción; "node version" es incorrecto
```

En Bash, `~` representa `/home/<usuario>`. Linux distingue mayúsculas de minúsculas y usa `/` como separador.

## 3. Versiones requeridas

| Componente | Requisito del repositorio | Referencia usada |
|---|---|---|
| Node.js | `^20.19.0` o `>=22.12.0` | CI: 22.12; imagen: 24 |
| npm | `11.8.0` | fijado en `packageManager` |
| Git | versión moderna con soporte TLS | requerido para clonar Canvas |
| Docker Compose | V2 (`docker compose`) | no se admite el binario legado `docker-compose` como única interfaz |

Compruebe:

```bash
node --version
npm --version
git --version
```

La versión global de npm puede diferir. Use el gestor fijado al instalar:

```bash
npx --yes npm@11.8.0 ci
```

`npm ci` elimina y reconstruye `node_modules` a partir de `package-lock.json`. No use `npm install` para reparar una instalación limpia, porque puede recalcular el lockfile.

### Qué crea la instalación de npm

- `package.json` declara workspaces, scripts y dependencias directas.
- `package-lock.json` fija el árbol resuelto y sus integridades.
- `node_modules/` contiene las librerías descargadas y ejecutables locales como Vite, Vitest y ESLint.

`node_modules` es un artefacto generado, grande y no versionado. No se edita manualmente. Puede reconstruirse con `npm ci`, pero eliminarlo innecesariamente pierde caché y obliga a descargar todo otra vez.

## 4. Obtener el repositorio

```bash
git clone https://github.com/JaimeArriagadaRosas/Plugin-Feedback-Canvas.git
cd Plugin-Feedback-Canvas
npx --yes npm@11.8.0 ci
```

Si trabaja desde una rama concreta:

```bash
git clone --branch fix/linux-native-setup-hardening --single-branch \
  https://github.com/JaimeArriagadaRosas/Plugin-Feedback-Canvas.git
```

Antes de ejecutar cualquier setup:

```bash
pwd
git status
git branch --show-current
```

## 5. Runtime de contenedores

Docker es necesario para Canvas local, PostgreSQL de integración, Gotenberg y Testcontainers. No es necesario para lint ni para el build del cliente.

| Plataforma | Runtime recomendado | Automatización del proyecto |
|---|---|---|
| Windows | Docker Desktop con backend WSL2 | adaptador `WinDockerInstaller` |
| Ubuntu/WSL2 | Docker Engine nativo rootless para la matriz Linux; alternativamente integración Docker Desktop | adaptadores `Linux…`; no mezclar ambos sin elegir contexto/socket |
| Linux APT | Docker CE del repositorio oficial y rootless | configura keyring/repositorio oficial tras consentimiento `sudo` |
| Linux DNF/Pacman | paquetes de la distribución y rootless cuando esté disponible | comandos específicos del gestor |
| macOS | OrbStack o Docker Desktop | adaptador `MacDockerInstaller`; requiere interacción de Gatekeeper |

El preflight distingue cuatro estados: CLI ausente, daemon apagado, permiso denegado y daemon activo. Encontrar el ejecutable `docker` no demuestra que exista un servidor accesible; `docker info` sí lo comprueba.

## 6. Windows

1. Instale Node compatible y Git.
2. Instale/abra Docker Desktop con backend WSL2.
3. Compruebe en la terminal donde ejecutará el plugin:

```powershell
docker info
docker compose version
npx --yes npm@11.8.0 ci
```

El instalador Windows puede descargar Docker Desktop y solicitar UAC. Un reinicio o cierre de sesión puede ser necesario después de instalarlo.

No termine automáticamente procesos que ocupan un puerto; identifique su propietario antes de actuar.

## 7. Linux nativo

El flujo APT actual usa el repositorio oficial de Docker CE e instala:

- `docker-ce`;
- `docker-ce-cli`;
- `containerd.io`;
- `docker-buildx-plugin`;
- `docker-compose-plugin`.

Antes de modificar el sistema, el setup muestra la acción y `sudo` solicita autorización. Si detecta paquetes conflictivos (`docker.io`, `podman-docker`, `containerd`, etc.), se detiene en vez de eliminarlos silenciosamente.

Después recomienda Docker rootless. Este modo evita dar al usuario acceso equivalente a `root` mediante el grupo `docker`. Si rootless falla, agregar el usuario al grupo es una alternativa separada que exige confirmación explícita y una sesión nueva.

Comprobación final:

```bash
docker context show
docker info
docker compose version
```

En rootless, `docker info` debe incluir `rootless` en `Security Options`.

## 8. Ubuntu sobre WSL2

Hay dos arquitecturas válidas, pero debe elegirse una:

### Engine nativo dentro de Ubuntu

Es el modo usado para probar la rama Linux. Docker y sus datos viven dentro de Ubuntu; el contexto habitual es `rootless` y el socket está bajo `/run/user/<uid>/docker.sock`.

Mantenga el proyecto en ext4:

```text
/home/<usuario>/proyectos/Plugin-Feedback
```

No ejecute builds intensivos desde `/mnt/c/...` o `/mnt/d/...`: son discos Windows montados y pueden producir peor rendimiento y diferencias de permisos con bind mounts.

### Integración de Docker Desktop

Active la distribución en Docker Desktop > Settings > Resources > WSL Integration y compruebe `docker info` desde Ubuntu. En este modo el daemon lo administra Docker Desktop.

No active ambos de forma implícita. Revise:

```bash
which docker
docker context ls
docker context show
docker info
```

Una ruta de CLI bajo `/mnt/c/Program Files/Docker/...` corresponde a interoperabilidad Windows, no a una instalación Linux nativa.

## 9. macOS

El setup permite OrbStack o Docker Desktop. Homebrew, el montaje de imágenes y Gatekeeper pueden abrir ventanas y pedir confirmación. Compruebe al terminar:

```bash
docker info
docker compose version
```

## 10. Disposición de carpetas

El modo 3 calcula `canvas-lms-master` como carpeta hermana del plugin:

```text
workspace/
├── Plugin-Feedback/
└── canvas-lms-master/
```

El setup fija Canvas en `release/2026-05-20.143`. Si el destino existe pero no parece una instalación reconocible, se detiene: no lo borra ni sobrescribe automáticamente.

## 11. Iniciar

```bash
npm start
```

Seleccione la opción 3 para Canvas local, o use:

```bash
NON_INTERACTIVE=true STARTUP_MODE=3 npm start
```

La primera ejecución puede descargar varios gigabytes y compilar assets durante un periodo prolongado. Mantenga la consola abierta y no inicie dos setups sobre la misma carpeta.

La diferencia con una repetición se explica por el trabajo inicial:

1. descarga del checkout y las imágenes base de Canvas;
2. instalación de gems de Ruby y paquetes JavaScript;
3. migraciones e inicialización de PostgreSQL;
4. compilación de traducciones y assets de Canvas;
5. creación de volúmenes, seeds y configuración LTI local.

Las ejecuciones posteriores reutilizan checkout, imágenes, volúmenes y marcadores reanudables. Aun así, el fast boot vuelve a comprobar el runtime; no garantiza «menos de un minuto» ni debe ocultar un contenedor degradado.

## 12. Acciones privilegiadas

El setup puede solicitar permiso para instalar paquetes, habilitar servicios, configurar rootless o modificar el archivo hosts. No debe:

- ejecutar instaladores de otro sistema operativo;
- eliminar paquetes conflictivos sin decisión explícita;
- agregar usuarios al grupo `docker` de forma oculta;
- borrar volúmenes, carpetas Canvas o procesos ajenos;
- ejecutar scripts remotos arbitrarios como sustituto del instalador versionado.

Para errores de instalación consulte [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## 13. Referencias oficiales

- [Microsoft: qué es WSL](https://learn.microsoft.com/windows/wsl/about)
- [Microsoft: comandos de WSL](https://learn.microsoft.com/windows/wsl/basic-commands)
- [Microsoft: trabajo entre filesystems Windows/Linux](https://learn.microsoft.com/windows/wsl/filesystems)
- [Docker Engine: instalación](https://docs.docker.com/engine/install/)
- [Docker: modo rootless](https://docs.docker.com/engine/security/rootless/)
- [npm: instalación limpia con `npm ci`](https://docs.npmjs.com/cli/v11/commands/npm-ci/)
