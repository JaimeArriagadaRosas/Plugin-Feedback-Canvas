# Plugin Feedback

Aplicacion web de retroalimentacion academica adaptativa integrada con Canvas LMS y potenciada por inteligencia artificial (Google Gemini). La aplicacion permite a profesores configurar plantillas de feedback, generar retroalimentacion personalizada automaticamente para estudiantes y gestionar su aprobacion antes del envio.

## Indice

*   [Descripcion del Proyecto](#descripcion-del-proyecto)
*   [Repo Structure Note](#repo-structure-note)
*   [Prerrequisitos](#prerrequisitos)
*   [Installation - Windows](#installation---windows)
*   [Installation - macOS](#installation---macos)
*   [Installation - Linux](#installation---linux)
*   [Running the Application](#running-the-application)
*   [Verification](#verification)
*   [Troubleshooting](#troubleshooting)

---

## Descripcion del Proyecto

Plugin Feedback es una herramienta LTI 1.3 que se integra como plugin externo en Canvas LMS. Su proposito es automatizar la generacion de retroalimentacion academica detallada para estudiantes, utilizando:

- **Plantillas personalizables**: Los profesores definen estructuras de feedback por rango de calificacion.
- **IA Generativa (Google Gemini)**: Adapta el contenido de cada retroalimentacion al historial academico y al rendimiento especifico de cada estudiante.
- **Flujo de aprobacion**: El profesor revisa, edita y aprueba el feedback antes de que llegue al estudiante.
- **Historial academico**: Cache local de calificaciones pasadas para enriquecer el contexto de la IA.
- **Roles diferenciados**: Interfaces para Administradores, Profesores y Estudiantes.

### Tecnologias

| Capa        | Tecnologia                          |
|-------------|-------------------------------------|
| Frontend    | React 18, Vite 5                   |
| Backend     | Node.js, Express                   |
| Base de Datos | PostgreSQL                       |
| IA          | Google Generative AI (Gemini)      |
| Integracion | LTI 1.3 (Canvas LMS)               |
| Testing     | Mocks nativos (sin framework extra) |

---

## Repo Structure Note

Solo la carpeta `Plugin Feedback/` sera subida al repositorio publico de GitHub. Los archivos y carpetas en la raiz del proyecto (documentacion, diagramas, scripts auxiliares, etc.) son excluidos del push.

Si al clonar el repositorio notas que faltan archivos o carpetas de documentacion que esperabas encontrar en la raiz, consulta la seccion [Repo Structure Note](#repo-structure-note) en este README para entender por que.

---

## Prerrequisitos

El proyecto soporta dos modos de ejecucion. Elige uno segun tus necesidades:

- **Modo Mock (Recomendado para desarrollo y pruebas rapidas)**: No requiere servicios externos. Utiliza datos simulados en memoria. Solo necesitas Node.js.
- **Modo Docker (Canvas LMS Local)**: Levanta una instancia completa de Canvas LMS en contenedores Docker. Requiere Docker Desktop. Ver `Plugin Feedback/src/servicios/CanvasLocalManager.js`.

### Requisitos minimos (Modo Mock)

| Herramienta | Version minima | Notas |
|-------------|----------------|-------|
| Node.js     | 18.x           | Incluye npm |
| npm         | 9.x            | Incluido con Node.js |

### Requisitos adicionales (Modo Docker)

| Herramienta    | Notas                                      |
|----------------|--------------------------------------------|
| Docker Desktop | WSL2 activo en Windows                     |
| Git            | Para clonar el repositorio                 |

> PostgreSQL es opcional. Si no esta disponible, el sistema cae automaticamente a modo Mock sin intervencion del usuario.

---

## Installation - Windows

### Paso 1: Instalar Node.js y npm

1. Ve a [https://nodejs.org](https://nodejs.org) y descarga la version LTS (18.x o superior).
2. Ejecuta el instalador.
3. Acepta todos los valores por defecto.
4. Al finalizar, abre una nueva terminal (PowerShell o Símbolo del sistema) y verifica:

```powershell
node --version
npm --version
```

Ambos comandos deben devolver números de version. Si obtienes un error de comando no reconocido, cierra y vuelve a abrir la terminal.

### Paso 2: Clonar el repositorio

```powershell
git clone <URL_DEL_REPOSITORIO>
cd "Proyecto Plugin feedback\Plugin Feedback"
```

> La carpeta `Plugin Feedback` contiene espacios en el nombre. En PowerShell se accede con comillas, o navega manualmente con `Tab` para autocompletar.

### Paso 3: Instalar dependencias

```powershell
npm install
```

Esto instalara todas las dependencias declaradas en `package.json` dentro de `Plugin Feedback/node_modules/`.

### Paso 4: Configurar variables de entorno

Copia el archivo de ejemplo y editalo con tus valores:

```powershell
Copy-Item env_example .env
notepad .env
```

Edita las siguientes variables en `.env`:

```env
# Canvas LMS
VITE_CANVAS_BASE_URL=http://localhost:8080
VITE_CANVAS_ACCESS_TOKEN=

# Modo mock (true para desarrollo sin servicios externos)
VITE_USE_MOCK_DATA=true

# Base de datos (solo si usas modo real sin Docker)
# DB_HOST=localhost
# DB_USER=postgres
# DB_PASSWORD=password
# DB_NAME=feedback_plugin_db
# DB_PORT=5432

# Seguridad
ENCRYPTION_KEY=

# IA - Gemini
GEMINI_API_KEY=

# LTI 1.3 (solo necesario si usas Canvas Local Docker o LTI real)
# LTI_CLIENT_ID=
# CANVAS_OIDC_URL=
# LTI_REDIRECT_URI=
# FRONTEND_URL=
```

En **Modo Mock** solo necesitas configurar `GEMINI_API_KEY` y asegurarte de que `VITE_USE_MOCK_DATA=true`. El resto de las variables se autocompletan cuando usas Canvas Local con Docker o se dejan vacías para modo Mock.

> **Importante**: Nunca subas el archivo `.env` al repositorio. Contiene credenciales y secretos. Usa `env_example` como plantilla pública.

---

## Installation - macOS

### Paso 1: Instalar Node.js y npm

**Opcion A — Homebrew (recomendada si ya lo tienes instalado):**

```bash
brew install node@18
```

**Opcion B — Instalador oficial:**

1. Ve a [https://nodejs.org](https://nodejs.org) y descarga la version LTS (18.x o superior) para macOS.
2. Ejecuta el archivo `.pkg` y sigue las instrucciones.
3. Abre una nueva terminal y verifica:

```bash
node --version
npm --version
```

### Paso 2: Clonar el repositorio

```bash
git clone <URL_DEL_REPOSITORIO>
cd "Proyecto Plugin feedback/Plugin Feedback"
```

### Paso 3: Instalar dependencias

```bash
npm install
```

### Paso 4: Configurar variables de entorno

```bash
cp env_example .env
nano .env  # o el editor de tu preferencia: vim, code, etc.
```

Edita las variables igual que en la seccion de Windows. Para modo Mock, asegurate de que `VITE_USE_MOCK_DATA=true` este presente.

---

## Installation - Linux

### Paso 1: Instalar Node.js y npm

**Ubuntu / Debian:**

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Fedora / RHEL / CentOS:**

```bash
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo dnf install -y nodejs
```

**Arch Linux:**

```bash
sudo pacman -S nodejs npm
```

Verifica la instalacion:

```bash
node --version
npm --version
```

### Paso 2: Clonar el repositorio

```bash
git clone <URL_DEL_REPOSITORIO>
cd "Proyecto Plugin feedback/Plugin Feedback"
```

### Paso 3: Instalar dependencias

```bash
npm install
```

### Paso 4: Configurar variables de entorno

```bash
cp env_example .env
nano .env  # o vim, code, etc.
```

Edita las variables igual que en la seccion de Windows. En modo Mock, las unicas variables requeridas son:

```env
VITE_USE_MOCK_DATA=true
GEMINI_API_KEY=tu_api_key_aqui
```

Las variables LTI y Canvas se autocompletan automaticamente al usar Canvas Local con Docker.

---

## Running the Application

La aplicacion consta de dos procesos que deben ejecutarse simultaneamente: el **frontend** (Vite) y el **backend** (Express). Abre dos terminales separadas en la carpeta `Plugin Feedback/`.

### Terminal 1 — Backend (Express)

```bash
npm run server
```

El backend escucha en `http://localhost:3000`. Deberias ver el mensaje:

```
BACKEND INICIADO (Puerto Interno: 3000)
Modo de Inicio: MOCKUP (Simulado)
```

### Terminal 2 — Frontend (Vite + React)

```bash
npm run dev
```

El frontend escucha en `http://localhost:5173`. Deberias ver el mensaje:

```
VITE v5.x.x  ready in xxx ms
➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

### Abrir en el navegador

Accede a `http://localhost:5173/` en tu navegador. El frontend enruta todas las peticiones `/api` automaticamente al backend en el puerto 3000 mediante el proxy de Vite configurado en `vite.config.js`.

### Si usas Docker + Canvas LMS Local

Antes de ejecutar, asegurate de que Docker Desktop este abierto y en ejecucion:

```bash
# Inicia el backend con Canvas Local (modo no interactivo)
# Requiere Docker Desktop corriendo
$env:NON_INTERACTIVE="true"
$env:STARTUP_MODE="3"
npm run server
```

En Linux / macOS:

```bash
NON_INTERACTIVE=true STARTUP_MODE=3 npm run server
```

El proceso levantara los contenedores Docker, ejecutara las migraciones Ruby de Canvas, compilara assets y configurara LTI automaticamente. Los logs de Docker se guardan en `Plugin Feedback/logs/docker_canvas.log`.

---

## Verification

### 1. Verificar que el backend responde

Abre otra terminal y ejecuta:

```bash
curl http://localhost:3000/api/config/startup-mode
```

Debe devolver un JSON con `mode`, `useMock`, `role`, etc. Cualquier respuesta JSON valida indica que el backend esta funcionando.

### 2. Verificar que el frontend carga

Abre `http://localhost:5173/` en tu navegador. Deberias ver la interfaz del plugin con un selector de curso (en modo Mock) o el panel de administracion.

### 3. Verificar que el proxy funciona

Desde el navegador, abre las herramientas de desarrollador (F12), ve a la pestaña Network y navega por la aplicacion. Las peticiones a `/api/...` deben tener status 200 y provenir de `localhost:5173`, no de `localhost:3000` directamente (eso confirma que el proxy de Vite esta activo).

### 4. Verificar modo Mock activo

Si la aplicacion carga datos de ejemplo sin credenciales de Canvas, el modo Mock esta funcionando correctamente.

### 5. Verificar Gemini (opcional)

En modo Mock, la generacion con IA requiere una `GEMINI_API_KEY` valida en el archivo `.env`. Sin ella, la aplicacion funcionara pero retornara feedback de respaldo.

---

## Troubleshooting

### `npm install` falla con errores de permisos

No ejecutes `npm install` con `sudo`. Soluciones alternativas:

```bash
npm install --prefix "Proyecto Plugin feedback/Plugin Feedback"
```

O configura npm para usar un directorio de caché en tu carpeta de usuario:

```bash
npm config set cache ${HOME}/.npm-cache --global
```

### Puerto 3000 o 5173 ya en uso

Otro proceso esta ocupando el puerto. En Windows:

```powershell
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

En macOS / Linux:

```bash
lsof -ti:3000 | xargs kill -9
lsof -ti:5173 | xargs kill -9
```

### Docker falla en Windows (WSL2)

Asegurate de que Docker Desktop tenga WSL2 activo:

1. Abre Docker Desktop > Settings > Resources > WSL Integration.
2. Activa la integracion con tu distribucion WSL.
3. Reinicia Docker Desktop.

### CORS errors en el navegador

Verifica que el backend este corriendo en el puerto 3000 y que `vite.config.js` tenga el proxy configurado correctamente. Revisa que no haya otras instancias de Vite escuchando en el mismo puerto.

### La base de datos no conecta en modo real

Si no tienes PostgreSQL instalado, el sistema cambiara automaticamente a modo Mock y mostrara un warning en consola. Para usar PostgreSQL:

```bash
# Instalar PostgreSQL (varia por plataforma)
# Luego crear la base de datos:
psql -U postgres -c "CREATE DATABASE feedback_plugin_db;"
# Ejecutar migraciones:
psql -U postgres -d feedback_plugin_db -f src/datos/schema.sql
```

### Archivos `.backup`, `.new`, `.fixed` en el codigo

Los archivos como `PromptManager.js.backup`, `PromptManager.js.new`, `PromptManager.js.fixed`, entre otros, son artefactos de desarrollo. El archivo activo y utilizado es `src/servicios/PromptManager.js`. Estos archivos de respaldo pueden ignorarse y no deben editarse.

---

## Scripts Disponibles

| Comando            | Descripcion                                              |
|--------------------|-----------------------------------------------------------|
| `npm run dev`      | Inicia el servidor de desarrollo Vite (Frontend)          |
| `npm run server`   | Inicia el servidor backend Express (Backend)              |
| `npm run build`    | Compila el frontend para produccion                       |
| `npm run preview`  | Previsualiza la build de produccion localmente            |
