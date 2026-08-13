# Plugin Feedback para Canvas LMS

Aplicación web LTI 1.3 para generar, revisar, aprobar y enviar retroalimentación académica desde Canvas LMS. Combina plantillas configurables, variables de contexto y proveedores de inteligencia artificial, manteniendo al docente dentro del flujo de revisión antes de publicar feedback al estudiante.

> [!IMPORTANT]
> El proyecto está en **validación preproductiva**. El entorno local, las pruebas automatizadas y el setup de Canvas han sido validados en Windows y en Ubuntu/WSL2, pero el despliegue LTI institucional, el correo real, la operación continua y la matriz final sobre Linux nativo todavía requieren validación. No trate esta rama como una versión productiva certificada.

## Funcionalidades implementadas

- Creación y administración de plantillas de feedback.
- Variables globales y configuración de variables por curso.
- Generación individual y masiva asistida por IA.
- Revisión, edición, aprobación y envío docente.
- Visualización diferenciada para administración, profesores y estudiantes.
- Notas privadas, permisos por rol, auditoría y preferencias de notificación.
- Integración LTI 1.3 con Canvas y servicios LTI Advantage configurables.
- Entorno local reproducible con Canvas LMS, PostgreSQL, Redis y Gotenberg.
- Adaptadores para Gemini, OpenAI, Claude y endpoints compatibles configurados por el administrador.

## Estado de soporte

| Escenario | Estado | Observación |
|---|---|---|
| Lint, build y pruebas unitarias | Validado | Automatizados en CI con Node 22.12 y npm 11.8.0. |
| Canvas local en Windows | Validado con reservas | Requiere Docker Desktop y una ejecución limpia final en otro equipo Windows. |
| Canvas local en Ubuntu sobre WSL2 | Validado | Probado con Docker Engine rootless; WSL2 no sustituye una certificación en host Linux independiente. |
| Linux nativo | Implementado, pendiente de certificación | El instalador separa APT/DNF/Pacman y recomienda Docker rootless. |
| LTI 1.3 contra Canvas institucional | Pendiente | Requiere staging, Developer Key, scopes y pruebas con usuarios reales de prueba. |
| Producción | No certificado | Faltan validaciones de infraestructura, correo, observabilidad, backup, seguridad y rollback. |

Los riesgos y tareas abiertas se mantienen en [Deuda técnica](TECHNICAL_DEBT.md).

## Documentación

| Necesidad | Documento |
|---|---|
| Instalar en Windows, Linux, WSL2 o macOS | [Instalación multiplataforma](INSTALLATION.md) |
| Levantar Canvas y usar cuentas de prueba | [Desarrollo local](LOCAL_DEVELOPMENT.md) |
| Comprender componentes y límites | [Arquitectura](ARCHITECTURE.md) |
| Consultar decisiones arquitectónicas | [Decisiones](DECISIONS.md) |
| Variables, versiones y secretos | [Entorno de ejecución](ENVIRONMENT.md) |
| Entender las variables configurables | [Variables](VARIABLES.md) |
| Ejecutar y entender las pruebas | [Estrategia de pruebas](TESTING.md) |
| Preparar una validación institucional | [Despliegue](DEPLOYMENT.md) |
| Revisar un despliegue institucional | [Despliegue institucional](INSTITUTIONAL_DEPLOYMENT.md) |
| Resolver errores frecuentes | [Troubleshooting](TROUBLESHOOTING.md) |
| Contribuir al monorepo | [Contribución](CONTRIBUTING.md) |
| Entender el escaneo de secretos | [Gitleaks](GITLEAKS.md) |
| Reportar una vulnerabilidad | [Política de seguridad](SECURITY.md) |

## Requisitos

- Git.
- Node.js `^20.19.0` o `>=22.12.0`.
- npm `11.8.0` para reproducir exactamente el lockfile.
- Docker Engine con Compose V2 para Canvas local, PostgreSQL de integración y Testcontainers.
- Al menos 8 GiB disponibles para el stack local de Canvas; más memoria y espacio libre mejoran el primer build.

Docker no es necesario para leer el código, ejecutar lint ni compilar el frontend. Consulte la [matriz por plataforma](INSTALLATION.md#runtime-de-contenedores) antes de instalarlo.

## Inicio rápido

Clone el repositorio y entre en él:

```bash
git clone https://github.com/JaimeArriagadaRosas/Plugin-Feedback-Canvas.git
cd Plugin-Feedback-Canvas
```

Instale el árbol fijado por `package-lock.json` con la versión declarada de npm:

```bash
npx --yes npm@11.8.0 ci
```

Inicie el orquestador:

```bash
npm start
```

El menú ofrece cuatro modos:

1. Ejecutar el runtime LTI 1.3 preparado para un Canvas externo.
2. Asistir el registro/despliegue de la herramienta LTI.
3. Preparar y ejecutar Canvas LMS local mediante contenedores.
4. Ejecutar validaciones de caja negra del proyecto.

Para seleccionar Canvas local sin menú:

```bash
NON_INTERACTIVE=true STARTUP_MODE=3 npm start
```

> [!NOTE]
> La primera preparación de Canvas descarga imágenes y dependencias, ejecuta migraciones y compila una cantidad grande de assets. Su duración y espacio requerido dependen del equipo, la red y la caché; no existe un tiempo fijo garantizado.

## Estructura del repositorio

```text
Plugin-Feedback/
├── apps/
│   ├── client/                 # React, Vite, vistas y componentes
│   ├── server/                 # API, dominio, LTI y adaptadores runtime
│   └── installer/              # Consola, instalación, despliegue y plataformas
├── packages/
│   ├── contracts/              # Contratos compartidos cliente/servidor
│   ├── canvas-api/             # Cliente neutral de Canvas
│   └── plugin-database/        # Migraciones y acceso de infraestructura compartido
├── tools/
│   └── canvas-local/           # Seeds, fixtures y parches para un Canvas externo
├── config/                     # Configuración versionada de la herramienta LTI
├── docs/                       # Documentación técnica y operativa
├── docker-compose*.yml         # Composiciones del plugin
├── package.json                # Scripts y workspaces del monorepo
└── package-lock.json           # Resolución reproducible de dependencias
```

Canvas LMS se mantiene fuera del repositorio porque es una dependencia externa de simulación:

```text
carpeta-de-trabajo/
├── Plugin-Feedback/
└── canvas-lms-master/          # Creada o preparada por el modo 3
```

En Linux/WSL2, mantenga ambas carpetas bajo `/home/<usuario>/...`; ejecutar builds Linux desde `/mnt/c` o `/mnt/d` introduce sobrecosto de I/O y diferencias de permisos.

## Comandos principales

| Comando | Propósito |
|---|---|
| `npm start` | Consola y orquestador principal. |
| `npm run dev` | Servidor de desarrollo Vite del cliente. |
| `npm run server` | Backend Node sin el flujo completo del orquestador. |
| `npm run build` | Build de producción del frontend. |
| `npm run lint` | ESLint unificado de todo el monorepo. |
| `npm test` | Suite Vitest del repositorio. |
| `npm run test:client` | Pruebas de cliente/Storybook en Chromium. |
| `npm run test:integration` | Integración backend; requiere Docker/Testcontainers. |
| `npm run test:e2e` | Playwright; algunas especificaciones siguen en maduración. |
| `npm run db:migrate` | Migraciones SQL explícitas del plugin. |
| `npm run deploy:lti` | Asistente de registro LTI; no equivale a certificación productiva. |
| `npm run diagnose` | Diagnóstico local de configuración. |
| `npm run setup:hosts` | Añade `canvas.docker` al archivo hosts con autorización. |

## URLs locales

| Servicio | URL habitual |
|---|---|
| Backend/plugin | `https://localhost:3000` |
| Frontend Vite | `https://localhost:5173` |
| Canvas mediante proxy TLS | `https://localhost:8443` |
| Canvas HTTP interno/local | `http://localhost:8080` |
| Gotenberg local del plugin | `http://localhost:3001` |

Los certificados locales pueden requerir confianza explícita en el navegador. No reutilice esos certificados ni las credenciales de prueba en producción.

## Cuentas locales sintéticas

El modo 3 siembra cuentas destinadas exclusivamente al entorno de desarrollo:

| Rol | Usuario | Contraseña inicial |
|---|---|---|
| Administrador | `admin@canvas.local` | `password123` |
| Profesor principal | `profesor@canvas.local` | `password123` |
| Profesores adicionales | `profesor2@canvas.local`, `profesor3@canvas.local` | `password123` |
| Estudiantes | `estudiante1@canvas.local` a `estudiante5@canvas.local` | `password123` |

El orquestador muestra las credenciales locales al finalizar el setup. Son valores públicos de prueba: nunca deben habilitarse en un entorno accesible desde Internet.

## Configuración y secretos

El setup crea `.env` cuando no existe y conserva un archivo existente. No versionar:

- claves de proveedores de IA;
- tokens o secretos de Canvas;
- claves privadas LTI;
- contraseñas reales de PostgreSQL;
- certificados privados.

La lista de variables y su alcance se documenta en [ENVIRONMENT.md](ENVIRONMENT.md). La configuración productiva debe provenir de un gestor de secretos o del sistema de despliegue, no de imágenes ni commits.

## Verificación mínima antes de proponer cambios

```bash
npx --yes npm@11.8.0 run lint
npx --yes npm@11.8.0 test
npx --yes npm@11.8.0 run build
npx playwright install chromium
npx --yes npm@11.8.0 run test:client
```

Consulte [TESTING.md](TESTING.md) para distinguir pruebas unitarias, integración, UI aislada y E2E LTI real.

## Contribución y seguridad

- Máximo recomendado: 300 líneas por archivo y 100 por función.
- La lógica específica de plataforma vive en adaptadores `Windows…`, `Linux…`, `Wsl…` o `Mac…`.
- No existe una carpeta global `scripts/`: cada comando pertenece a `installer`, `server` o un package explícito.
- Cada corrección de un defecto debe añadir una prueba de regresión proporcional.
- No agregue limpiezas destructivas, terminación de procesos desconocidos ni elevación silenciosa.

Lea [CONTRIBUTING.md](CONTRIBUTING.md) antes de modificar el proyecto y [SECURITY.md](SECURITY.md) antes de comunicar una vulnerabilidad.

## Licencia

Este repositorio no incluye todavía un archivo `LICENSE`. Hasta que el mantenedor defina una licencia explícita, no debe asumirse una concesión de uso, modificación o redistribución más allá de lo permitido por la legislación aplicable y por los acuerdos del proyecto.
