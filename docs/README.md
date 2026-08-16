# Plugin Feedback para Canvas LMS

Plugin Feedback es una aplicación web LTI 1.3 que se integra con Canvas LMS para generar, revisar, aprobar y enviar retroalimentación académica. El profesor conserva el control del flujo: puede usar plantillas, variables de contexto y proveedores de IA, pero revisa y aprueba el feedback antes de que llegue al estudiante.

> [!IMPORTANT]
> El proyecto está en validación preproductiva. El modo local permite desarrollar y probar el plugin con una instancia simulada de Canvas, pero no certifica por sí mismo un despliegue institucional ni producción.

## Índice

- [Descripción y documentación relacionada](#descripción-y-documentación-relacionada)
- [Abrir una consola o terminal](#abrir-una-consola-o-terminal)
- [Programas requeridos](#programas-requeridos)
- [Organización de carpetas](#organización-de-carpetas)
- [Instalación paso a paso](#instalación-paso-a-paso)
- [Qué hacen npm, npm ci y node_modules](#qué-hacen-npm-npm-ci-y-nodemodules)
- [Variables de entorno](#variables-de-entorno-env)
- [Compilación y ejecución](#compilación-y-ejecución)
- [La capa de instalación de la opción 3](#la-capa-de-instalación-de-la-opción-3)
- [Por qué tarda la primera ejecución](#por-qué-tarda-la-primera-ejecución)
- [Ejecución manual para desarrollo](#ejecución-manual-para-desarrollo)
- [Cuentas locales de prueba](#cuentas-locales-de-prueba)
- [Pruebas y resolución de problemas](#pruebas-y-resolución-de-problemas)

## Descripción y documentación relacionada

El repositorio es un monorepo: contiene el cliente React, el servidor Node.js, el instalador interactivo, contratos compartidos y el acceso a datos. Canvas LMS **no** pertenece al dominio del plugin: el modo local lo prepara como una carpeta hermana para simular la plataforma real.

Esta guía enseña el primer uso. Los temas especializados permanecen en documentos separados para evitar duplicarlos:

| Necesidad | Documento |
|---|---|
| Instalar en Windows, Linux, WSL2 o macOS | [Instalación multiplataforma](INSTALLATION.md) |
| Entender los modos y el ciclo diario de Canvas | [Desarrollo local](LOCAL_DEVELOPMENT.md) |
| Permisos de volumen y compatibilidad de Docker | [Compatibilidad Docker](DOCKER_COMPATIBILITY.md) |
| Variables, versiones, secretos y recursos | [Entorno de ejecución](ENVIRONMENT.md) |
| Ejecutar las pruebas | [Estrategia de pruebas](TESTING.md) |
| Diagnosticar errores | [Troubleshooting](TROUBLESHOOTING.md) |
| Contribuir al monorepo | [Contribución](CONTRIBUTING.md) |
| Despliegue LTI institucional | [Despliegue](DEPLOYMENT.md) |

## Abrir una consola o terminal

La consola es una ventana de texto desde la que se ejecutan comandos. Todos los comandos de este documento se escriben después del prompt y se confirman con `Enter`.

### Windows

> [!TIP]
> **Rendimiento:** Si el arranque o compilación son muy lentos en Windows nativo, se recomienda encarecidamente añadir la carpeta del proyecto a las **exclusiones de Windows Defender**. El escaneo en tiempo real de miles de archivos pequeños (como los de `node_modules` o contenedores de Docker) penaliza drásticamente el disco.
> Puedes hacerlo abriendo PowerShell como Administrador y ejecutando:
> `Add-MpPreference -ExclusionPath "C:\Ruta\A\Tu\Proyecto"`

Abra **Windows Terminal**, **PowerShell** o **Símbolo del sistema (CMD)** desde Inicio. Para una prueba WSL, abra directamente la aplicación **Ubuntu**: ahí ya está dentro de Linux.

### Ubuntu sobre WSL2

Abra la aplicación **Ubuntu** desde Inicio. No escriba `wsl -d Ubuntu-26.04` dentro de Ubuntu: `wsl` es un comando de administración de Windows y se usa desde PowerShell o CMD.

### Linux nativo y macOS

En Linux normalmente se abre la terminal con `Ctrl+Alt+T`. En macOS, abra **Terminal** desde Spotlight con `Cmd+Espacio`.

### Sintaxis mínima

```bash
pwd                         # muestra la carpeta actual
ls -la                      # lista archivos, incluidos los ocultos
cd carpeta                  # entra a una carpeta
cd ..                       # sube un nivel
cd "ruta con espacios"      # entra a una ruta que contiene espacios
node --version              # muestra la versión; "node version" es incorrecto
```

En Linux y macOS, `~` significa la carpeta personal del usuario. Linux distingue mayúsculas de minúsculas y usa `/` como separador de rutas.

## Programas requeridos

Node.js y Git son prerrequisitos externos: el proyecto está escrito en Node.js, por lo que `npm start` necesita un Node funcional antes de poder iniciar el instalador. Docker es necesario solo para Canvas local, PostgreSQL de integración, Gotenberg y pruebas con Testcontainers.

| Componente | Requisito | Para qué se usa |
|---|---|---|
| Git | versión moderna con TLS | clonar el plugin y Canvas LMS |
| Node.js | `^20.19.0` o `>=22.12.0` | ejecutar el instalador, backend y herramientas |
| npm | `11.8.0` para instalaciones reproducibles | respetar `package-lock.json` |
| Docker Compose | Compose V2: `docker compose` | Canvas y servicios locales |
| Memoria y disco | al menos 8 GiB disponibles para Canvas | imágenes, assets y bases de datos locales |

Compruebe cualquier instalación con:

```bash
node --version
npm --version
git --version
docker info
docker compose version
```

### Windows

Instale una versión LTS compatible de [Node.js](https://nodejs.org/) y Git. Para el modo 3, instale y abra Docker Desktop con backend WSL2. El instalador puede orientar o automatizar parte de Docker, pero Node.js continúa siendo un requisito del usuario.

### Ubuntu, WSL2 y Linux nativo

En Ubuntu, WSL2 y Linux nativo, instale Node para ese entorno Linux. Una opción recomendada es NVM: administra versiones de Node por usuario y no requiere `sudo`.

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.6/install.sh | bash
source ~/.bashrc
nvm install 22
nvm alias default 22
node --version
command -v node
```

La última línea debe mostrar una ruta bajo `~/.nvm/`. Si abre una terminal nueva, NVM cargará la versión predeterminada. Consulte las [instrucciones oficiales de NVM](https://github.com/nvm-sh/nvm#installing-and-updating) si su shell no carga `~/.bashrc`.

Al seleccionar el modo 3 en Ubuntu, el proyecto puede pedir confirmación y contraseña `sudo` para instalar Docker Engine, Docker Compose, Docker rootless o `mkcert` cuando falten.

### macOS

Instale Node LTS y Git con sus instaladores oficiales o el gestor que use su equipo. Para Canvas local use Docker Desktop u OrbStack. La automatización de certificados en macOS aún requiere validación adicional; consulte [Instalación multiplataforma](INSTALLATION.md).

## Organización de carpetas

En Windows puede guardar una copia del repositorio donde prefiera. En Linux/WSL2, se recomienda trabajar desde la carpeta personal del usuario, por ejemplo `/home/<usuario>/projects`. Así las dependencias, permisos y montajes Docker se mantienen en el mismo entorno Linux y los builds suelen ser más rápidos.

El modo 3 prepara Canvas como carpeta hermana:

```text
projects/
├── Plugin-Feedback-Canvas/  # este repositorio
└── canvas-lms-master/       # creado por la opción 3; dependencia externa
```

No mueva ni mezcle código del plugin dentro de `canvas-lms-master`. Tampoco suba Canvas, `node_modules`, certificados, archivos `.env`, tokens o volúmenes Docker al repositorio.

## Instalación paso a paso

### 1. Clonar el proyecto

Desde Ubuntu/WSL2, clone la versión estable del proyecto desde `main`:

```bash
mkdir -p ~/projects
cd ~/projects
git clone --branch main --single-branch \
  https://github.com/JaimeArriagadaRosas/Plugin-Feedback-Canvas.git
cd ~/projects/Plugin-Feedback-Canvas
```

Compruebe siempre dónde está antes de comenzar:

```bash
pwd
git branch --show-current
git status
```

### 2. Instalar dependencias e iniciar

Con Node nativo compatible ya instalado, el comando habitual es:

```bash
npm start
```

Si `node_modules` no existe o está incompleto, el prearranque instala automáticamente las dependencias mediante `npx --yes npm@11.8.0 ci`. Por eso, para una primera ejecución normal, no necesita ejecutar antes `npm ci` ni `npm install` a mano.

Cuando aparezca el menú, seleccione:

```text
[3] Ejecutar localmente Canvas LMS (Entorno Docker de desarrollo)
```

Mantenga la consola abierta mientras Canvas se instala o está en ejecución. Para detener los procesos que inició el orquestador, use `Ctrl+C` una sola vez y espere el cierre ordenado.

### 3. Instalación manual de dependencias, solo cuando se necesite

Para reconstruir explícitamente dependencias ya diagnosticadas, use la versión fijada de npm:

```bash
npx --yes npm@11.8.0 ci --no-fund --no-audit
```

`package-lock.json` contiene las versiones verificadas del proyecto; consérvelo al reconstruir dependencias.

## Qué hacen npm, npm ci y node_modules

`package.json` es la lista declarada de herramientas y scripts del proyecto. `package-lock.json` fija las versiones exactas y sus integridades. `node_modules/` es la carpeta generada que contiene las librerías descargadas y ejecutables locales como Vite, Vitest y ESLint.

| Comando | Uso correcto en este repositorio | Efecto |
|---|---|---|
| `npm start` | inicio normal | ejecuta el orquestador y repara dependencias faltantes con npm fijado |
| `npx --yes npm@11.8.0 ci` | reconstrucción manual controlada | recrea `node_modules` exactamente desde el lockfile |
| `npm install` | agregar o actualizar una dependencia de forma intencional | puede recalcular el lockfile; no es la reparación rutinaria |

`node_modules` puede ocupar cientos de MB. No se versiona ni se edita a mano. Borrarlo obliga a descargar e instalar otra vez; no borra el código fuente, pero sí prolonga el siguiente arranque.

## Variables de entorno (.env)

En local, el orquestador crea `.env` desde su plantilla segura cuando no existe y genera claves de desarrollo faltantes. Para ejecutar la opción 3 normalmente no necesita escribir secretos a mano.

Puede editar `.env` para configurar proveedores IA, puertos o credenciales locales de prueba, pero nunca debe subirlo a Git. Tampoco copie a producción tokens de Canvas, claves privadas LTI, certificados locales o cuentas sintéticas. La lista de variables y su alcance está en [Entorno de ejecución](ENVIRONMENT.md).

> [!WARNING]
> Si se regeneran claves locales mientras existen volúmenes con datos anteriores, algunos datos cifrados pueden dejar de ser legibles. El instalador no borra volúmenes automáticamente: respalde y decida un reset de forma explícita.

## Compilación y ejecución

`npm start` abre una consola interactiva con cuatro modos:

| Opción | Propósito |
|---:|---|
| 1 | Runtime LTI 1.3 para un Canvas externo |
| 2 | Asistente de registro y despliegue LTI |
| 3 | Canvas LMS local en Docker: modo principal para desarrollo y QA |
| 4 | Validaciones de caja negra del proyecto |

Para Canvas local sin responder el menú:

```bash
NON_INTERACTIVE=true STARTUP_MODE=3 npm start
```

Al terminar correctamente, las direcciones habituales son:

| Servicio | Dirección |
|---|---|
| Plugin / backend | `https://localhost:3000` |
| Frontend Vite | `https://localhost:5173` |
| Canvas mediante proxy TLS | `https://localhost:8443` |
| Canvas HTTP interno | `http://localhost:8080` |
| Gotenberg local | `http://localhost:3001` |

El navegador se abre con el navegador predeterminado del usuario. En WSL, Canvas y Docker viven dentro de Ubuntu, pero el navegador y su almacén de certificados pertenecen a Windows.

## La capa de instalación de la opción 3

La opción 3 no solo “abre una ventana”. Comprueba y prepara componentes de manera reanudable:

1. Verifica Node, npm, Git, Docker, Compose, memoria, puertos y permisos.
2. Crea o conserva `.env`, claves locales y la configuración mínima.
3. Clona Canvas LMS como carpeta hermana, sin incorporarlo al monorepo.
4. Levanta los servicios base de Canvas y prepara su configuración Docker.
5. Instala gems Ruby, paquetes Yarn, traducciones y compila los assets de Canvas.
6. Inicializa PostgreSQL, Redis, contenedores `web` y `jobs` de Canvas.
7. Inserta datos sintéticos, instala la configuración LTI local y sincroniza usuarios.
8. Levanta PostgreSQL y Gotenberg del plugin, aplica sus migraciones y arranca el backend.
9. Genera certificados HTTPS de desarrollo, levanta el proxy TLS y abre Canvas cuando responde.

Las preguntas interactivas dependen de lo que falte. En una Ubuntu recién creada pueden aparecer confirmaciones para instalar Docker y rootless con `sudo`, instalar `mkcert` y `libnss3-tools`, crear una CA local y —en WSL— confiar solo en la CA pública en el almacén del usuario de Windows. Una ejecución posterior reutiliza herramientas, imágenes, assets y marcadores como `.assets_built` y `.setup_complete`, por lo que hará menos preguntas.

## Por qué tarda la primera ejecución

La primera ejecución suele requerir entre **20 y 35 minutos**, aunque puede tardar más según la red, CPU, memoria, disco y la disponibilidad de cachés. No cierre la consola solo porque haya actividad prolongada.

Las partes más costosas son:

- descargas de imágenes Docker y del checkout de Canvas, que ocupan varios GiB;
- instalación de gems Ruby y paquetes JavaScript de Canvas;
- migraciones y semillas de las bases de datos;
- compilación de traducciones y assets visuales de Canvas.

Las ejecuciones posteriores suelen ser mucho más rápidas porque reutilizan las imágenes, contenedores, volúmenes y assets. Aun así, el instalador vuelve a revisar el estado crítico: una ejecución rápida no sustituye una comprobación de salud.

## Ejecución manual para desarrollo

Cuando ya existen las dependencias y no necesita preparar Canvas desde cero, puede levantar partes por separado:

Terminal 1:

```bash
npm run server
```

Terminal 2:

```bash
npm run dev
```

Vite recarga cambios del frontend. El backend se reinicia manualmente cuando cambia su código. Este modo no crea Canvas, Docker, seeds ni el proxy completo; úselo solo si entiende y ya tiene listos esos componentes.

Para generar el build del frontend:

```bash
npm run build
```

Para añadir el alias local `canvas.docker` al archivo hosts:

```bash
npm run setup:hosts
```

Ese último comando modifica el archivo hosts y requiere autorización. Para revertirlo:

```bash
npm run setup:hosts -- --remove
```

## Cuentas locales de prueba

El modo 3 genera datos sintéticos exclusivos del entorno local:

| Rol | Usuario | Contraseña inicial |
|---|---|---|
| Administrador | `admin@canvas.local` | `password123` |
| Profesor principal | `profesor@canvas.local` | `password123` |
| Profesores adicionales | `profesor2@canvas.local`, `profesor3@canvas.local` | `password123` |
| Estudiantes | `estudiante1@canvas.local` a `estudiante5@canvas.local` | `password123` |

Son fixtures públicas de desarrollo. Nunca las use para staging, producción ni cuentas reales.

## Pruebas y resolución de problemas

Antes de cambiar código, confirme dónde está y guarde el primer error completo:

```bash
pwd
node --version
npm --version
git status
docker info
docker compose version
```

Problemas frecuentes:

| Síntoma | Primera acción segura |
|---|---|
| `node version` busca un archivo | use `node --version` |
| Node no está disponible en Ubuntu/Linux | instale Node mediante NVM y compruebe `node --version` |
| `wsl: command not found` dentro de Ubuntu | ya está en Linux; ejecute `wsl` solo desde Windows |
| Docker no responde | compruebe `docker context show` y `docker info`; no mezcle Docker Desktop y rootless sin elegir uno |
| Puerto ocupado | identifique el proceso antes de detenerlo |
| certificado no confiable | ejecute `npm run verify:https`; no desactive TLS globalmente |
| Canvas tarda o no responde | revise `docker compose ps` y los logs de `web`, `jobs` y `postgres` antes de borrar datos |

Para comandos concretos, limpieza segura y casos por plataforma consulte [Troubleshooting](TROUBLESHOOTING.md). Para las suites automáticas use:

```bash
npx --yes npm@11.8.0 run lint
npx --yes npm@11.8.0 test
npx --yes npm@11.8.0 run build
```

No use `docker system prune -a --volumes`, `git clean -fdx`, `rm -rf`, `kill -9` ni cambios globales de permisos como primer diagnóstico. Esas acciones pueden borrar datos, cachés o trabajo útil.
