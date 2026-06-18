# Plugin Feedback - Canvas LMS

Aplicación web de retroalimentación académica adaptativa integrada con Canvas LMS y potenciada por Inteligencia Artificial (IA). Permite a los profesores configurar plantillas de feedback, generar retroalimentación personalizada automáticamente para los estudiantes y gestionar su aprobación antes del envío.

---

## Índice

*   [Descripción del Proyecto](#descripción-del-proyecto)
*   [Cómo abrir la Consola / Terminal](#cómo-abrir-la-consola--terminal)
*   [Instalación de Programas Requeridos](#instalación-de-programas-requeridos)
*   [Organización de Carpetas y Estructura](#organización-de-carpetas-y-estructura)
*   [Guía de Instalación Paso a Paso](#guía-de-instalación-paso-a-paso)
*   [Configuración de Variables de Entorno (.env)](#configuración-de-variables-de-entorno-env)
*   [Compilación y Ejecución](#compilación-y-ejecución)
*   [Usuarios de Prueba Locales (Canvas LMS)](#usuarios-de-prueba-locales-canvas-lms)
*   [Resolución de Problemas Frecuentes (Troubleshooting)](#resolución-de-problemas-frecuentes-troubleshooting)

---

## Descripción del Proyecto

El **Plugin Feedback** es una herramienta integrada en Canvas LMS. Su propósito es automatizar la generación de retroalimentación académica detallada para estudiantes, utilizando:

*   **Plantillas personalizables:** Los profesores definen estructuras de feedback según rangos de calificación.
*   **Modelos de Inteligencia Artificial (IA):** Adaptan el contenido de cada retroalimentación al rendimiento específico de cada estudiante.
*   **Flujo de aprobación:** El profesor revisa, edita y aprueba el feedback antes de que sea visible para el estudiante.
*   **Roles diferenciados:** Vistas diseñadas para Administradores, Profesores y Estudiantes.

---

## Cómo abrir la Consola / Terminal

Para instalar y ejecutar este proyecto, necesitarás usar la línea de comandos de tu sistema operativo. Sigue estas instrucciones para abrirla:

### En Windows:
1.  Presiona la tecla **Inicio** (o presiona la tecla `Windows` en tu teclado).
2.  Escribe **cmd** (Símbolo del sistema) o **PowerShell**.
3.  Presiona **Enter**.

### En macOS:
1.  Presiona las teclas `Cmd + Espacio` para abrir el buscador Spotlight.
2.  Escribe **Terminal**.
3.  Presiona **Enter**.

### En Linux:
*   Presiona la combinación de teclas `Ctrl + Alt + T` en tu teclado.

> [!NOTE]
> **Navegación básica:** Para entrar a una carpeta desde la consola, escribe el comando `cd` seguido de la ruta entre comillas. Ejemplo: `cd "C:\Mis Proyectos\Proyecto Plugin feedback\Plugin Feedback"`.

---

## Instalación de Programas Requeridos

Antes de ejecutar el proyecto, debes instalar las siguientes herramientas en tu computadora:

1.  **Node.js (LTS):** Motor que permite ejecutar la aplicación backend y compilar el frontend.
    *   **Cómo descargarlo:** Entra a la página oficial de [Node.js](https://nodejs.org/), haz clic en la versión recomendada **LTS** para tu sistema operativo y descarga el instalador.
    *   **Instalación:** Abre el archivo descargado, presiona "Siguiente" (Next) en todas las pantallas y acepta las opciones recomendadas por defecto hasta terminar.
2.  **Docker Desktop:** Requerido únicamente para correr la versión local y completa de Canvas LMS.
    *   **Cómo descargarlo:** Entra a [Docker Desktop](https://www.docker.com/products/docker-desktop/) y descarga la versión correspondiente para tu sistema operativo.
    *   **Instalación:** Abre el instalador y sigue las instrucciones de pantalla (en Windows asegúrate de mantener marcada la opción de utilizar WSL2/Hyper-V).
    *   **Uso:** **Basta con tener la aplicación Docker Desktop abierta ejecutándose en segundo plano** antes de iniciar la instalación de Canvas. No requieres realizar ninguna configuración interna en Docker.

---

## Organización de Carpetas y Estructura

Para evitar errores de rutas y asegurar que el instalador automatizado funcione correctamente, te recomendamos organizar tus carpetas de la siguiente forma:

1.  Crea una carpeta contenedora principal (por ejemplo, `Proyecto Plugin feedback` en tu disco).
2.  Dentro de ella, coloca los archivos de este repositorio dentro de una carpeta llamada exactamente `Plugin Feedback`.
3.  **Clonación de Canvas LMS:** Cuando ejecutes el asistente de instalación interactivo y selecciones montar Canvas localmente (opción 3), el script clonará automáticamente el repositorio `canvas-lms-master` al lado de la carpeta de tu plugin.

La estructura final de carpetas lucirá así:
```text
Proyecto Plugin feedback/
├── Plugin Feedback/      <-- Carpeta raíz de este plugin (donde está este archivo)
└── canvas-lms-master/    <-- Creada automáticamente por el instalador interactivo
```

---

## Guía de Instalación Paso a Paso

### Paso 1: Entrar a la carpeta del plugin mediante consola
Antes de poder instalar dependencias o ejecutar el proyecto, debes asegurarte de que tu consola esté posicionada dentro de la carpeta del plugin. Para ello, utiliza el comando `cd` (cambiar de directorio):

*   **Si abres la consola de manera general, navega escribiendo la ruta completa:**
    ```bash
    cd "d:\Descargas\Proyecto Plugin feedback\Plugin Feedback"
    ```
*   **Si ya te encuentras en la carpeta contenedora principal (`Proyecto Plugin feedback`), entra al plugin con:**
    ```bash
    cd "Plugin Feedback"
    ```

> [!TIP]
> Sabrás que estás en el lugar correcto porque el texto al principio de la línea en tu consola terminará con `...\Plugin Feedback>`.

---

### Paso 2: Instalar las dependencias de Node.js
Una vez dentro de la carpeta en la consola, sigue las instrucciones según tu sistema operativo:

### En Windows (PowerShell)

Si usas PowerShell, es posible que Windows bloquee la ejecución de scripts locales de Node. Ejecuta este comando para habilitarlos temporalmente en tu sesión de consola actual:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
```

Luego, instala las dependencias de Node.js ejecutando:
```powershell
npm install
```

### En macOS y Linux (Terminal)

Ejecuta el siguiente comando para instalar las dependencias:
```bash
npm install
```

*(Esto creará la carpeta `node_modules` localmente con todas las librerías necesarias del proyecto).*

---

### ¿Qué hace exactamente `npm install` y cómo cambia tu carpeta?

Cuando ejecutas `npm install`, el sistema realiza las siguientes tareas de forma automática:
1.  **Lectura de instrucciones:** Lee el archivo `package.json` de tu proyecto, que funciona como una "lista de compras" donde se definen todas las librerías externas que requiere la aplicación para funcionar (por ejemplo, React, Express, etc.).
2.  **Descarga de paquetes:** Se conecta a internet para descargar la versión exacta de cada librería especificada.
3.  **Creación de `node_modules`:** Al finalizar el comando, verás que en la carpeta raíz `Plugin Feedback/` se habrá creado automáticamente una nueva carpeta llamada **`node_modules/`**.

**¿Cómo se ve tu carpeta tras la instalación?**
```text
Plugin Feedback/
├── db/
├── node_modules/         <-- ¡NUEVA CARPETA CREADA! Contiene miles de subcarpetas
├── src/
├── package.json
├── package-lock.json
└── ... (otros archivos)
```
> [!NOTE]
> **¿Qué es la carpeta `node_modules`?**
> Imagínala como una "caja de herramientas" gigante. Contiene miles de pequeños archivos de código que tu aplicación usará de fondo. Puede llegar a pesar entre 100 MB y 300 MB. **Es completamente normal y nunca debes borrarla ni modificarla manualmente**, ya que de ella depende que el plugin arranque.

---

## Configuración de Variables de Entorno (.env)

El archivo `.env` guarda información de configuración confidencial.
1.  Encuentra el archivo [`env_example`](file:///d:/Descargas/Proyecto%20Plugin%20feedback/Plugin%20Feedback/env_example) en la raíz de la carpeta `Plugin Feedback`.
2.  Duplica este archivo en la misma carpeta y cámbiale el nombre a **`.env`** (asegúrate de que empiece con un punto y no tenga extensión `.txt`).
    *   *En consola (Windows PowerShell):* `Copy-Item env_example .env`
    *   *En consola (macOS/Linux):* `cp env_example .env`
3.  Abre el archivo `.env` con cualquier editor de texto.
4.  Si solo quieres hacer pruebas rápidas locales sin montar Docker ni base de datos, mantén la siguiente variable en `true`:
    ```env
    VITE_USE_LOCAL_DATA=true
    ```
5.  Si deseas probar la integración de Inteligencia Artificial, agrega tu API Key de IA en la variable correspondiente (por ejemplo: `GEMINI_API_KEY=tu_clave_aqui`).

---

## Compilación y Ejecución

El proyecto ofrece un script interactivo en consola para administrar el inicio y configuración de las capas del sistema.

### Ejecución Interactiva (Recomendado)

En la terminal dentro de `Plugin Feedback`, ejecuta el siguiente comando:
```bash
node src/index.js
```
*(O también puedes usar el comando alternativo: `npm start`)*

Este comando abrirá un menú interactivo en la terminal con tres opciones.

> [!IMPORTANT]
> **Menú de selección (Opción 3):** Actualmente, **únicamente la opción 3** (`[3] Ejecutar localmente Canvas LMS (Open Source)`) está completamente operativa y funciona correctamente.

> [!WARNING]
> **Duración de la primera ejecución:** Al seleccionar la opción 3 por primera vez, el proceso descarga, configura y compila la infraestructura de Canvas LMS y la base de datos local dentro de Docker. Este proceso es pesado y **puede tardar entre 30 y 45 minutos** en completarse. No cierres la ventana de la consola hasta que finalice.

> [!WARNING]
> **Bugs conocidos de visualización:** En la versión actual del frontend del plugin, las pantallas de administrador, profesor y estudiante experimentan un problema visual de superposición (se mezclan en pantalla). Este bug está identificado y se resolverá en próximas actualizaciones.

---

### ¿Qué es la "Capa de Instalación" de la Opción 3 y qué componentes instala?

Cuando ejecutas el script interactivo y seleccionas la **Opción 3** (`Ejecutar localmente Canvas LMS`), el script entra en la "capa de instalación". Si es la primera vez que lo corres y no tienes nada configurado, el instalador realizará el siguiente flujo automatizado:

1.  **Detección Automática de Componentes:** 
    El instalador analiza tu computadora para verificar si Docker Desktop está corriendo, y busca si ya existe el código de Canvas LMS clonado en tu disco. Si nota que faltan componentes, los instalará automáticamente uno por uno.
2.  **Clonación de la Plataforma Canvas LMS:** 
    Descarga de manera automática la carpeta completa de la plataforma de aprendizaje virtual `canvas-lms-master` al lado del plugin.
3.  **Creación e Inicialización de Contenedores Docker:**
    Docker creará mini "computadoras virtuales" independientes (contenedores) que se ejecutarán de fondo en tu PC. Instalará y configurará:
    *   **Base de Datos PostgreSQL (Contenedor):** El motor donde se guarda toda la información.
    *   **Servidor de Aplicaciones (Contenedor Web):** Encargado de procesar y mostrar la plataforma Canvas LMS en tu navegador.
    *   **Servidor de Trabajos en Cola (Contenedor Redis/Jobs):** Encargado de las tareas pesadas de fondo de Canvas LMS, como el envío de correos o notificaciones.
4.  **Instalación de Dependencias de Ruby/Rails:**
    Dado que Canvas LMS está escrito en una tecnología diferente al plugin (llamada Ruby on Rails), el instalador descarga todos los paquetes de código internos específicos de Ruby (llamados "gemas") que Canvas necesita para ejecutarse.
5.  **Configuración e Inicialización de la Base de Datos:**
    Crea la estructura de base de datos desde cero, inyectando miles de tablas vacías y configurando el usuario administrador por defecto para que puedas iniciar sesión.
6.  **Compilación de Assets (Recursos Visuales):**
    Traduce, junta y comprime todas las imágenes, estilos de diseño (CSS) y código interactivo de la interfaz de Canvas LMS para que cargue lo más rápido posible en el navegador.

---

### ¿Por qué demora entre 30 y 45 minutos la primera vez?

La demana se debe principalmente a tres procesos sumamente pesados que exigen mucho esfuerzo del procesador y la memoria de tu computadora:
*   **Descarga inicial:** Docker debe descargar imágenes base que pesan varios Gigabytes en total.
*   **Compilación de recursos visuales (Assets):** Canvas LMS es una plataforma gigantesca con miles de archivos de diseño que deben unirse y optimizarse. Este proceso por sí solo suele tomar más de 20 minutos de procesamiento continuo.
*   **Migraciones de base de datos:** El sistema debe ejecutar miles de scripts para dibujar y estructurar la base de datos interna PostgreSQL.

Una vez que este largo proceso se completa exitosamente la primera vez, **las siguientes ejecuciones tardarán menos de un minuto**, ya que los componentes quedarán guardados en tu sistema y Docker solo tendrá que encenderlos.

---

### Compilación y Ejecución Manual (Desarrollo)

Si eres desarrollador y deseas levantar por separado las partes del proyecto de manera tradicional, abre dos pestañas de terminal en la carpeta `Plugin Feedback` y ejecuta:

#### Pestaña 1 — Iniciar Servidor Backend (Express)
```bash
npm run server
```
El servidor backend arrancará en el puerto `http://localhost:3000`.

#### Pestaña 2 — Iniciar Frontend de Desarrollo (Vite + React)
```bash
npm run dev
```
El frontend de desarrollo estará disponible en `http://localhost:5173/`.

#### Compilación de producción del Frontend
Para verificar que el frontend compila correctamente y no tiene errores de código de cara a su distribución en producción, ejecuta:
```bash
npm run build
```
Esto generará una carpeta `dist/` en la raíz con el código minimizado y optimizado.

---

## Usuarios de Prueba Locales (Canvas LMS)

Al montar la plataforma localmente con Docker (Opción 3), se inyectará una base de datos de prueba con usuarios y contraseñas listos para iniciar sesión y testear el comportamiento del plugin LTI.

### 1. Administrador de Canvas
Tiene permisos para configurar integraciones y gestionar todas las cuentas:
*   **Correo:** `admin@canvas.local`
*   **Contraseña:** `adminpassword123`

### 2. Profesor (Elena Ramírez)
Tiene permisos para calificar tareas, crear plantillas de feedback y autorizar envíos de retroalimentación con IA:
*   **Correo:** `profesor@canvas.local`
*   **Contraseña:** `teacherpassword123`

### 3. Estudiantes Matriculados
Tienen permisos para ingresar y visualizar su historial académico y el feedback asignado por el profesor:
*   **Estudiante 1 (Juan Perez):**
    *   **Correo:** `estudiante1@canvas.local`
    *   **Contraseña:** `estudiante1pass`
*   **Estudiante 2 (Maria Garcia):**
    *   **Correo:** `estudiante2@canvas.local`
    *   **Contraseña:** `estudiante2pass`
*   **Estudiante 3 (Pedro Lopez):**
    *   **Correo:** `estudiante3@canvas.local`
    *   **Contraseña:** `estudiante3pass`
*   **Estudiante 4 (Ana Torres):**
    *   **Correo:** `estudiante4@canvas.local`
    *   **Contraseña:** `estudiante4pass`
*   **Estudiante 5 (Carlos Mendez):**
    *   **Correo:** `estudiante5@canvas.local`
    *   **Contraseña:** `estudiante5pass`

---

## Resolución de Problemas Frecuentes (Troubleshooting)

### Error de permisos de scripts en Windows (UnauthorizedAccess)
Si al ejecutar `npm` obtienes un error que indica que la ejecución de scripts está deshabilitada en el sistema, abre PowerShell y ejecuta:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
```
Esto te permitirá ejecutar los scripts de Node únicamente durante la sesión actual de esa consola.

### Puertos ya ocupados (3000 o 5173)
Si te aparece un error que indica que los puertos ya están siendo utilizados por otra aplicación, puedes liberar los puertos manualmente:

*   **En Windows (CMD/PowerShell):**
    ```powershell
    netstat -ano | findstr :3000
    taskkill /PID <PID_encontrado> /F
    ```
*   **En macOS o Linux:**
    ```bash
    lsof -ti:3000 | xargs kill -9
    lsof -ti:5173 | xargs kill -9
    ```

### Docker Desktop no responde o falla WSL2 en Windows
Asegúrate de que Docker Desktop esté abierto y configurado con la integración de WSL2 activa:
1.  Abre **Docker Desktop**.
2.  Ve a **Settings (Engranaje) > Resources > WSL Integration**.
3.  Activa la casilla correspondiente a tu distribución Linux de WSL activa.
4.  Presiona **Apply & restart** y vuelve a arrancar el comando en tu consola.
