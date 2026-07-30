# Documentación del Flujo Local LTI 1.3

Este documento describe brevemente cómo funciona el entorno de desarrollo local (`.local.js`) en relación con la autenticación LTI 1.3 y la inyección de datos, para agilizar el desarrollo de UI y lógica de negocio.

## Inyección de Datos Reales

A diferencia de un entorno tradicional que usa "mocks" estáticos en el frontend, este proyecto asegura paridad con producción mediante la **inyección de datos reales en la base de datos local**.
El entorno local se conecta a una instancia local de la base de datos y scripts de *seeding* inyectan estructuras reales provenientes de Canvas LMS (cursos, usuarios, asignaciones, rúbricas). 

## Flujo LTI 1.3 Real vs Bypass Local

El flujo LTI 1.3 en el entorno de desarrollo puede operar de dos maneras:

### 1. Flujo LTI Real Completo
Si se levanta el entorno y se conecta con una instancia (real o local) de Canvas LMS, el handshake OIDC de LTI 1.3 se ejecuta de manera idéntica a producción. Los tokens JWT se firman y validan, y se generan las cookies de sesión y estado (state, nonce).

### 2. Bypass LTI para Desarrollo Rápido
Para no tener que iniciar sesión en Canvas cada vez que se quiere hacer una prueba rápida de UI, existe un **bypass** implementado en `apps/server/src/middlewares/AuthLTI13Handler.local.js`.

**¿Cómo funciona?**
Se activa mediante la variable de entorno `ENABLE_TEST_AUTH_BYPASS=true`.
El middleware busca una cookie llamada `lti-token`. Si la cookie contiene el prefijo `dev-token`, se salta la validación criptográfica estricta de OIDC y *simula* un contexto LTI válido.

**Inyección de Roles (Simulación):**
El token manual dicta el rol que asume el usuario:
- `dev-token:admin` -> Simula un Administrador Institucional.
- `dev-token:teacher` -> Simula un Profesor/Instructor.
- `dev-token:student` -> Simula un Estudiante (Learner).

Esto inyecta en el objeto `req.ltiContext` los IDs locales (`00000000-0000-0000-0000-000000000002` para estudiante) y la URN correcta del rol, permitiendo el enrutamiento y autorización de endpoints sin pasar por Canvas.

## Arquitectura del Entorno de Desarrollo Local (Setup)

La opción `[3] Ejecutar localmente Canvas LMS` del orquestador (`npm start`) ha sido diseñada con grado de producción para tolerar despliegues pesados en máquinas locales sin desbordar la memoria RAM.

### Prevención de Out-Of-Memory (OOM) en el Setup
Al compilar y levantar Canvas LMS (`rake canvas:compile_assets`), los contenedores generan gigabytes de logs (stdout/stderr). El orquestador implementa las siguientes defensas para evitar que Node.js colapse durante este flujo local:

1. **Streaming con Backpressure:** Los flujos de salida del contenedor Docker no se retienen en variables. Se usa streaming nativo directo hacia archivos en disco (`logs/canvas_build.log`). Si el disco local es lento, el orquestador aplica backpressure, pausando automáticamente el contenedor para que la RAM no actúe como embudo.
2. **Buffer Circular Seguro (TailBuffer):** Para mostrar reportes de error al usuario, el orquestador solo almacena en memoria las últimas 50 líneas del proceso. Se utiliza un algoritmo plano seguro (`Array.concat`) que no es susceptible a límites del motor V8 (Maximum call stack size exceeded).
3. **Bypass de la Caché Interna (execa):** Se fuerza `buffer: false` en los subprocesos para impedir que la librería subyacente consuma la memoria de forma oculta.

### Siembra de Datos (Data Seeder)
El flujo local también inyecta automáticamente perfiles de usuarios (profesores, estudiantes) y un token OIDC/LTI local mediante el script de setup. Este script se ejecuta mediante subprocesos y cuenta con los mismos mecanismos OOM-proof (buffer circular) que protegen al servidor durante la inyección de datos pesada.
