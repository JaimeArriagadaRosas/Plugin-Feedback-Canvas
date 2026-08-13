# Auditoría y verificación de bugs y opción 4 en Windows

**Proyecto:** Plugin-Feedback-Canvas  
**Fecha:** 2026-08-13  
**Repositorio:** `D:\Descargas\Proyecto Plugin feedback\Plugin-Feedback-Canvas`  
**Plataforma de ejecución:** Windows, `cmd.exe`, Node.js instalado nativamente  
**Rama requerida y auditada:** `main`  
**Commit inicial auditado:** `9ccf1a6a33781e61c9aff619e49bf1ec5dcfcf8c`  

## 1. Alcance, restricciones y criterio de verificación

Esta fase fue exclusivamente de auditoría, instalación de dependencias, compilación y pruebas. No se modificó código, configuración, estado de Git, contenedores, imágenes, volúmenes, clones, ramas ni datos. La única incorporación al repositorio es este informe, solicitada como entrega. Los archivos Markdown personales situados en `D:\Descargas\Proyecto Plugin feedback`, fuera del repositorio, se inventariaron y no se tocaron.

Un bug solo se clasifica como **corregido** cuando existe evidencia ejecutada que prueba directamente el comportamiento en el nivel disponible. **Parcial** significa que una capa está cubierta, pero falta otra capa necesaria o queda un flujo alternativo defectuoso. **No corregido** significa que la implementación actual todavía reproduce o conserva la causa. **No verificable** significa que faltó Canvas, Docker, PostgreSQL, Gotenberg, credenciales o un servicio externo y no existe sustituto ejecutable suficiente.

Se distingue entre:

- **Unitaria:** proceso aislado, con dependencias simuladas.
- **Integración:** interacción real entre módulos y/o PostgreSQL efímero.
- **E2E:** navegador y sistema completo, con Canvas local o real.
- **Manual:** inspección o ejecución dirigida desde CMD sin automatización de aserciones.
- **Estática:** lectura de código/configuración; no equivale a una prueba aprobada.

## 2. Línea base Git y entorno

La auditoría comenzó con los comandos obligatorios:

```bat
cd /d "D:\Descargas\Proyecto Plugin feedback\Plugin-Feedback-Canvas"
git status
git branch --show-current
git rev-parse HEAD
```

Resultado inicial:

- `git status`: árbol limpio, `main` alineada con `origin/main`.
- Rama: `main`.
- Commit: `9ccf1a6a33781e61c9aff619e49bf1ec5dcfcf8c`.

Cambios recientes relevantes inspeccionados:

| Commit | Descripción | Relevancia |
|---|---|---|
| `9ccf1a6` / `86a84ee` | Documentación de onboarding y setup local | Procedimiento de Windows |
| `02c908f` | Navegador predeterminado y salida TLS compacta | Navegador/certificados |
| `cf88dd3` | Bootstrap de certificados por plataforma | Windows, `mkcert`, confianza TLS |
| `73b0bb6` | Runtime local Canvas y bootstrap LTI | Docker, puertos, Canvas local |
| `d400212` | Nueva inspección del runtime Docker | Docker Desktop/daemon |
| `ce2b6d0` | Sincronización/refactorización amplia | Bugs funcionales, monorepo e instalador |

Entorno observado desde CMD:

| Componente | Resultado |
|---|---|
| Node.js | `v24.13.1`, `D:\Componentes\nodejs\node.exe`; compatible con `^20.19.0` o `>=22.12.0` |
| npm | `11.8.0`, coincide con `packageManager` |
| Docker CLI | `29.6.2`, disponible |
| Docker Compose | `v5.3.1`, disponible |
| Contexto Docker | `desktop-linux` |
| Docker Engine | **No disponible**: pipe `dockerDesktopLinuxEngine` inexistente; Docker Desktop no estaba iniciado |
| `mkcert` | No encontrado en `PATH` |
| `winget` | No encontrado en `PATH` |
| Certificados locales | `apps/server/certs` no existe |
| Hosts | No existe entrada `canvas.docker` |
| Puertos | Sin listeners en `3000`, `5173` ni `8443` al terminar las pruebas |
| Permisos del repositorio | Usuario actual y usuarios autenticados con permiso de modificación; Administradores/SYSTEM con control total |
| `.env` / setup | No existen `.env`, `.setup_complete` ni clon hermano `canvas-lms-master` |

## 3. Resumen ejecutivo

La conclusión global es **no aprobada para declarar corrección completa en Windows**.

- 1 bug se acredita como corregido en la capa de código/migración con prueba unitaria ejecutada: bug 4.
- 5 bugs están parciales: 1, 2, 3, 9 y 10.
- 4 bugs siguen no corregidos: 5, 6, 7 y 8.
- La **opción 4 externa del instalador no funciona completamente desde CMD/Windows**. El submenú se alcanza, pero las opciones que usan `npx.cmd` fallan con `spawnSync npx.cmd EINVAL`.
- La suite raíz no está verde en Windows: 109 pruebas pasan, 1 falla y 1 se omite. La falla es una aserción Linux no portable en `local-workspace-paths.test.js`.
- `lint`, `build`, pruebas de cliente y pruebas backend aisladas pasan; eso no prueba los flujos Canvas, campañas, correo, Gotenberg ni RF06 de extremo a extremo.
- El E2E LTI no pudo ejecutarse por falta de Canvas en `https://localhost:8443`; la ejecución global quedó colgada y fue terminada por timeout a los 600 segundos.

## 4. Matriz por bug

| # | Estado | Evidencia concreta | Archivos implicados | Prueba ejecutada y resultado | Riesgo | Propuesta de corrección |
|---:|---|---|---|---|---|---|
| 1 | **Parcial** | UI y contrato consideran `EDITADO`; SQL masivo selecciona `PENDIENTE` y `EDITADO`. Después marca `APROBADO` y lanza la subida a Canvas en una promesa no durable y no esperada. | `packages/contracts/src/feedback.js:14`; `apps/client/src/views/feedback/review/useFeedbackReview.js:280`; `FeedbackTable.jsx:35`; `apps/server/src/services/FeedbackWorkflowService.js:49-90`; `apps/server/tests/unit/audit-regressions.test.js:159-173` | Unitaria backend: pasa y comprueba SQL/teacher/count. Sin integración DB/Canvas ni E2E. | Una caída tras marcar `APROBADO` puede dejar feedback sin publicar y fuera de futuros lotes. | Job durable/outbox, estado intermedio reintentable, prueba PostgreSQL+gateway y E2E del lote con `EDITADO`. |
| 2 | **Parcial** | El panel principal usa guardia en memoria, deshabilita durante envío, cierra al éxito y el backend reclama el registro atómicamente. El flujo alternativo `FeedbackDetailView` pasa props incompatibles a `ConfirmDialog` y la ruta no entrega `feedback`. | `useFeedbackReview.js:230-252`; `ApprovalModal.jsx:217-224`; `FeedbackRepository.js:173-182`; `audit-regressions.test.js:176-228`; `FeedbackDetailView.jsx`; `useFeedbackDetail.js`; `TeacherLayout.jsx`; `ConfirmDialog.jsx` | Unitaria backend de concurrencia: pasa, una sola publicación Canvas simulada. Sin prueba React/E2E del cierre. | Doble acción mitigada en el panel principal, pero el detalle alternativo está roto/no renderiza y no está protegido por test. | Corregir contrato de props/ruta, reutilizar el mismo hook idempotente y agregar prueba de componente con doble clic y cierre exitoso. |
| 3 | **Parcial** | Ruta, controlador, servicio, repositorio y DTO manejan `nota_privada`; la UI espera la mutación antes de aprobar. La prueba de ruta simula el controlador y no toca PostgreSQL. No se observa control de propiedad profesor-feedback en el `UPDATE`. | `private_notes.routes.js`; `PrivateNoteController.js`; `PrivateNoteService.js`; `FeedbackRepository.js:213-218`; `FeedbackQueryService.js:84,123,157`; migración `006_add_nota_privada...sql`; `audit-regressions.test.js:42-85` | Unitarias: pasan validación de ID y mapeo DTO. Sin integración de persistencia ni E2E de recarga. | Nota puede no persistir en un entorno real; un profesor con permiso podría modificar un ID ajeno si conoce el ID. | Test de integración insert/update/read, filtro por profesor/curso y test de UI que guarda, recarga y verifica. |
| 4 | **Corregido** (código/migración) | `StudentRole` entrega `view_feedback=true`; migración 022 fuerza `true` tanto al insertar como al actualizar el rol estudiante. | `apps/server/src/modules/permissions/roles/StudentRole.js:3-9`; `packages/plugin-database/migrations/022_normalize_role_permissions.sql:4-23`; `audit-regressions.test.js:88-90` | Unitaria ejecutada: pasa. La migración no se aplicó a una DB real en esta fase. | Bajo en código nuevo; medio si una instalación no ejecuta la migración. | Añadir prueba de migración real y smoke de permisos tras upgrade. |
| 5 | **No corregido** | La primera visita por sesión a tareas ejecuta `POST .../assignments/reset-active`, que desactiva persistentemente tareas. El visor PDF no reinicia `pageNumber`, `numPages`, `scale` ni `error` al cambiar `fileUrl`. Cada preview descarga/convierte sin caché, deduplicación ni límite de concurrencia. | `apps/client/src/views/cursos/hooks/useAssignmentList.js:48`; `course.routes.js:33`; `CourseService.js`; `ConfigRepository.js`; `SubmissionViewer.jsx:164-165`; `NativePdfViewer.jsx`; `FileController.js`; `file-controller.test.js` | Solo unidad de allowlist/endpoint Gotenberg: pasa. No prueba navegación, caché, concurrencia ni saturación. E2E indisponible. | Alto: estado incorrecto al navegar; preview obsoleto; conversiones repetidas y saturación de memoria/Gotenberg. | Eliminar reset destructivo en lectura, resetear visor por URL o usar `key`, cachear/deduplicar conversiones y añadir límites, métricas y E2E de navegación repetida. |
| 6 | **No corregido** | No se encontraron módulo, rutas, vista, servicio ni pruebas de importación de campañas en `apps/` o `packages/`; solo existe exportación de reportes CSV/Excel no equivalente. | Búsqueda global de `campaign`, `campaña`, `import` y rutas actuales; `exportFeedbackExcel.js` no es importación de campañas. | Inspección estática; no hay unidad/integración/E2E ejecutable del requisito. | Funcionalidad ausente o perdida en la sincronización reciente. | Recuperar/especificar contrato de campaña e importador, validar esquema/errores, transacción e idempotencia, y cubrir con fixtures e integración. |
| 7 | **No corregido** | Existen preferencias y lógica de notificación, pero producción inyecta `emailService=null`. La prueba verifica precisamente `NOTIFICATION_FAILED`; logs confirman “Proveedor de correo no configurado”. No hay campañas con las que relacionar RF42/RF44. | `PreferencesService.js`; `NotificationPreferencesForm.jsx`; `FeedbackMutationService.js:188-195`; `FeedbackWorkflowService.js:132-140`; `dependencyInjection.js:70-77`; `docs/TECHNICAL_DEBT.md` | Unitaria con mocks: pasa el camino de fallo y persistencia del error. No se enviaron correos reales. Sin integración de campañas/correo. | RF42/RF44 no pueden funcionar realmente en producción; el lote carece de garantía durable y la relación con campañas no existe. | Adaptador productivo o sandbox, outbox/reintentos, plantillas/eventos RF42/RF44 y pruebas contractuales con proveedor simulado. |
| 8 | **No corregido** | La UI consulta `/config/me` pero no usa `meData` para disponibilidad IA; el endpoint no expone estado de IA. Los controles IA permanecen activos y el backend lanza error si no hay llave. El modo manual es voluntario, no fallback solo lectura. | `useSpeedGraderData.js`; `SpeedGraderPanel.jsx:30`; `AIControls.jsx`; `SystemConfigController.js`; `IAConfigManager.js:30` | Inspección estática. No existe prueba RF64. No verificable E2E sin sesión/DB, pero la causa está presente en código. | Datos crudos o mensajes `[ERROR]` visibles; acciones inválidas mientras carga; UX inconsistente. | Exponer capacidad IA saneada, estado de carga explícito, fallback automático read-only/manual y pruebas por matriz sin llave/llave inactiva/llave válida. |
| 9 | **Parcial** | El servicio intenta resolver nombre en Canvas y la unitaria guarda “Ada Lovelace”. Si falla, usa `Estudiante <ID>`; el cliente no envía nombre. El controlador prioriza `ltiUserId` sobre `canonicalUserId` para el profesor. | `ManualFeedbackController.js:15-48`; `FeedbackMutationService.js:43-46,249`; `audit-regressions.test.js:229-252` | Unitaria con Canvas simulado: pasa. Sin integración/E2E Canvas. | En fallos de lookup vuelve a aparecer el ID numérico; posible uso del identificador docente incorrecto para la consulta Canvas. | Resolver identidad desde una fuente canónica, fallar de forma visible en vez de degradar a ID, y probar IDs LTI/canónicos contra Canvas simulado. |
| 10 | **Parcial** | Hay vista, rutas y descubrimiento dinámico. La creación global escribe un resolver JavaScript en el árbol fuente y devuelve datos de ejemplo; la propia documentación marca RF06 experimental y criterios E2E pendientes. | `global_variables.routes.js`; controladores/servicios de variables; descubrimiento de resolvers; `docs/VARIABLES.md` | Inspección estática. No se llamó al endpoint porque habría modificado código fuente, prohibido en esta fase. Sin integración/E2E. | No funciona en despliegues inmutables o múltiples réplicas; no hay catálogo transaccional, rollback ni demostración extremo a extremo. | Persistir definiciones en DB, sandbox de expresiones/resolvers versionados, validación y E2E crear→configurar→generar feedback. |

## 5. Evidencia detallada por grupos funcionales

### 5.1 Revisión, envío individual y notas (bugs 1–3)

La prueba `apps/server/tests/unit/audit-regressions.test.js` aporta evidencia útil pero limitada:

- El lote incluye `EDITADO` en el SQL y restringe por profesor.
- Dos aprobaciones concurrentes solo permiten una llamada al gateway Canvas simulado mediante `claimForApproval`.
- La ruta de nota rechaza un ID no numérico y acepta uno válido.
- El DTO conserva `nota_privada` y valores numéricos cero.

No prueba PostgreSQL, cierre real del modal ni publicación a Canvas. En el envío masivo, `FeedbackWorkflowService.bulkApproveAndSend()` cambia a `APROBADO` dentro de una transacción y luego dispara `_processCanvasUploadsInBackground()` sin esperar ni persistir un job. La respuesta `{status: 'processing'}` no significa que Canvas recibió el feedback.

El flujo principal del modal está razonablemente protegido. Sin embargo, `FeedbackDetailView` monta `ConfirmDialog` sin la prop `isOpen` y pasa `onCancel` donde el componente espera `onClose`; además la ruta de `TeacherLayout` no le entrega el feedback. Por ello no se puede declarar corregido todo el envío individual.

### 5.2 Navegación, preview y Gotenberg (bug 5)

La causa más grave encontrada es que una lectura de asignaciones tiene efecto persistente: `useAssignmentList` llama una vez por sesión a `reset-active`, y el backend actualiza las tareas a inactivas. Esto puede explicar listas o previews incorrectas al cambiar de step o reactivar el plugin.

En paralelo, `NativePdfViewer` mantiene estado interno al cambiar el documento. Si el PDF anterior quedó en una página inexistente para el nuevo, o produjo error, ese estado puede contaminar el siguiente render. `FileController.preview` baja el archivo, lo mantiene en memoria y pide una conversión nueva a Gotenberg por solicitud, sin caché ni coordinación de solicitudes concurrentes. No se ejecutó `stress_test_gotenberg.js`: crea un archivo grande, requiere Gotenberg y finalmente lo elimina; además Docker no estaba operativo.

### 5.3 Campañas y notificaciones (bugs 6–7)

No se encontró implementación actual de campañas/importación. Por tanto no puede verificarse ni establecerse una relación operativa RF42/RF44↔campañas.

No se enviaron correos reales. Se usaron únicamente pruebas con mocks y evidencia de logs. En modo no productivo existe `EmailServiceLocal`; en producción `dependencyInjection.js` deja el adaptador en `null`, por diseño. La prueba auditada comprueba que el fallo se registra, no que llegue una notificación. Esto coincide con la deuda técnica documentada.

### 5.4 IA solo lectura (bug 8)

El backend conoce la ausencia de llave, pero el cliente no recibe ni consume una capacidad IA fiable antes de habilitar controles. Cuando el backend devuelve “No se encontró una llave de API activa…”, la UI no tiene una transición garantizada a solo lectura y sus filtros de errores conocidos no cubren todas las variantes. RF64 permanece abierto.

### 5.5 Nombre en feedback manual y variable RF06 (bugs 9–10)

El nombre se resuelve correctamente en la prueba aislada, pero la degradación explícita a `Estudiante <ID>` conserva el síntoma ante cualquier fallo de Canvas. Se requiere una prueba contractual de identidad.

RF06 tiene piezas visibles, pero crear una variable global escribe un archivo resolver dentro del source. No se ejecutó porque habría infringido la fase sin cambios. `docs/VARIABLES.md` también deja sin marcar los criterios extremo a extremo; por eso el estado es parcial y no corregido completamente.

## 6. Opción 4: verificación desde CMD

### 6.1 Qué es exactamente la opción 4

La opción solicitada es la **opción `[4]` del menú principal** de `npm start`, definida en `apps/installer/src/orchestration/cli.js`:

```text
[4] Validaciones de Caja Negra (Health Checks y Tests E2E)
```

`apps/installer/src/orchestration/main.js:45-49` la deriva directamente a `runBlackBoxTests(PLUGIN_DIR)`, espera Enter y termina con código 0/1. Importante: este camino ocurre antes de `prepareEnvironment`; por sí mismo no garantiza que `.env`, Canvas, DB, TLS o Docker estén listos.

El submenú real, definido en `apps/installer/src/orchestration/testRunner.js`, ejecuta:

| Subopción | Comando efectivo | Infraestructura | Cobertura real |
|---:|---|---|---|
| 1 | `npx.cmd --no-install vitest run apps/server/tests/` | Ninguna para unitarias; integración Docker se omite sin `RUN_DOCKER_TESTS` | Backend únicamente; no instalador, cliente ni E2E |
| 2 | Arranca `node apps/installer/src/preboot.js --mode=1` con `USE_LOCAL_DATA=true`; luego `node apps/server/tests/e2e/smoke.mjs` | Backend/DB/configuración local | Health/JWKS, no los 10 bugs |
| 3 | Arranca `preboot.js --mode=3`; luego `npx.cmd --no-install playwright test apps/client/tests/e2e/lti-flow.spec.js` | Docker, Canvas local, TLS, LTI | Solo flujo LTI; no suite E2E completa |
| 4 interna | `npx.cmd --no-install playwright test apps/client/tests/e2e/lti-flow.spec.js` con `E2E_TARGET=real` | Canvas real y credenciales | Solo flujo LTI real |
| 5 | Cuatro arranques modo 1 y `node apps/server/tests/e2e/stress.mjs` para `baseline`, `idempotency`, `circuitbreaker`, `ratelimiter` | Backend/DB | Rendimiento técnico, no cobertura funcional completa |

La opción 4 interna no debe confundirse con la opción 4 principal pedida por el usuario.

### 6.2 Resultado ejecutado en Windows/CMD

Secuencia manual reproducible:

```bat
cd /d "D:\Descargas\Proyecto Plugin feedback\Plugin-Feedback-Canvas"
npm start
```

Luego escribir `4` en el menú principal y `1` en el submenú. El resultado observado fue:

- El menú principal y el submenú se mostraron.
- La subopción 1 terminó con código 1 y mensaje genérico: `La suite local encontro fallos o no pudo ejecutarse.`
- No apareció la salida de Vitest.
- El comando equivalente lanzado directamente desde CMD sí pasó: 7 archivos backend aprobados, 1 integración omitida; 25 pruebas aprobadas y 1 omitida.

La causa se aisló con este comando seguro desde CMD:

```bat
node -e "const {execFileSync}=require('node:child_process');try{execFileSync('npx.cmd',['--no-install','vitest','--version'],{stdio:'inherit'});console.log('OK')}catch(e){console.error(e.code,e.errno,e.syscall);process.exit(1)}"
```

Resultado: `EINVAL`, `-4071`, `spawnSync npx.cmd`. `testRunner.js:160-162` elige correctamente el nombre `npx.cmd`, pero `execFileSync` no lo puede lanzar de esta manera en este Windows. Las subopciones 1, 3 y 4 interna comparten el mismo defecto. Además, `runProcess` descarta el error original, lo que impide diagnosticar desde la consola.

También se comprobó el uso por pipe:

```bat
(echo 4&echo 1&echo.)|npm start
```

Al crear una interfaz `readline` nueva para cada pregunta, el segundo prompt perdió la entrada canalizada y el proceso terminó sin correr pruebas. No sustituye una sesión humana TTY, pero demuestra que la automatización CMD/CI del menú tampoco es robusta.

### 6.3 Qué pruebas corrió realmente la opción 4

La ruta interactiva alcanzó el runner, pero **no llegó a ejecutar Vitest** por el error `spawnSync npx.cmd EINVAL`. Para separar el bug del menú del estado de las pruebas, se ejecutó directamente:

```bat
cmd.exe /d /s /c "npx --no-install vitest run apps/server/tests/"
```

Resultado: aprobado con 25 pruebas, una integración omitida. Esto no convierte la opción 4 en aprobada: demuestra que la suite backend funciona cuando CMD resuelve `npx`, mientras el orquestador falla.

### 6.4 Cobertura y limitaciones de la opción 4

- Subopción 1 no corre pruebas del instalador, de React ni Playwright.
- Subopciones 3/4 solo apuntan a `lti-flow.spec.js`, no a los diez bugs.
- El flujo LTI requiere Canvas local/real, registro LTI y credenciales.
- Subopciones 2/5 pueden arrancar servicios y escribir configuración a través de `preboot`; no se ejecutaron en esta fase.
- El modo local puede clonar Canvas y gestionar Docker/certificados. No se ejecutó porque Docker Engine estaba apagado y porque `CanvasCloner.js:145-147` llama automáticamente a `docker compose down` después del primer fallo de `up`, operación no autorizada en esta auditoría.

**Veredicto de opción 4:** **no funciona completamente desde CMD/Windows** y no ofrece cobertura suficiente para los bugs, incluso después de corregir el lanzamiento de `npx.cmd`.

## 7. Comandos de calidad y pruebas ejecutados

| Comando desde CMD/Windows | Tipo | Resultado | Interpretación |
|---|---|---|---|
| `npm ci` | Preparación reproducible | Aprobado: 986 paquetes. El primer intento restringido no pudo escribir logs npm; con permiso de ejecución normal terminó bien. | Dependencias instalables en Windows. `npm ls --depth=0` marca cinco paquetes WASM opcionales/extraneous, sin dependencias requeridas faltantes. |
| `npm test` | Unitaria raíz | **Falló**: 34 archivos pasan, 1 falla, 1 integración se omite; 109 tests pasan, 1 falla, 1 se omite. | Suite no verde en Windows. |
| `npm run lint` | Calidad estática | Aprobado, código 0. | No prueba comportamiento. |
| `npm run build` | Build cliente | Aprobado, 351 módulos. Advertencia por chunks >500 kB (`exceljs` ~930 kB y visor PDF ~421 kB). | Compila; queda riesgo de rendimiento, no validación funcional. |
| `npm run test:client` | Unitarias/componentes Storybook | Aprobado: 4 archivos de stories, 12 tests; 1 MDX omitido. | Ninguna story cubre los bugs auditados. |
| `npx --no-install vitest run apps/server/tests/` | Unitaria backend | Aprobado: 7 archivos, 25 tests; 1 integración omitida. | Backend aislado. |
| `npm run test:e2e` | E2E Playwright | **No aprobado**: timeout global a 600 s; LTI falla con `ERR_CONNECTION_REFUSED` en `https://localhost:8443/login/canvas`. | Canvas/backend no disponibles. No hay veredicto funcional de los bugs. |
| `npm run diagnose` | Diagnóstico manual | **Falló**: 10 correctos, 4 avisos, 7 errores. | Faltan `.env`, variables LTI/Canvas/IA y servicios; Docker daemon apagado. |
| `docker compose ... config --quiet` | Validación estática Compose | Aprobado para base, base+dev, base+prod y DB. | Sintaxis/merge válidos; no demuestra arranque. |

Falla exacta de `npm test`:

```text
apps/installer/tests/unit/local-workspace-paths.test.js:12
expected: /work/canvas
received: D:\work\canvas
```

La implementación usa `path.resolve`, por lo que el separador y resolución nativos son esperables; el test codifica un resultado Linux y constituye una regresión de portabilidad de la suite.

El navegador Playwright no estaba instalado. Se instaló únicamente Chromium de pruebas mediante:

```bat
npx --no-install playwright install chromium
```

Se descargó en el caché de Playwright (`D:\DevCaches\ms-playwright`); no se abrió el navegador predeterminado del usuario.

### Calidad real de los E2E existentes

`massive-feedback.spec.js` captura y descarta el fallo de título y termina con `expect(true).toBe(true)`. `login.spec.js` también solo afirma `true`. Esos casos pueden aprobar aunque la funcionalidad no exista. `lti-flow.spec.js` sí navega a Canvas, pero no pudo comenzar por ausencia del servicio. La existencia de estos archivos no acredita ningún bug.

La integración PostgreSQL usa Testcontainers y estaba omitida. No se forzó `npm run test:integration` porque crea y elimina contenedores efímeros automáticamente; hacerlo habría incumplido la prohibición explícita de eliminar contenedores sin autorización.

## 8. Regresiones Windows

| Área | Estado | Evidencia / regresión |
|---|---|---|
| Rutas | **Fallo confirmado** | Test Linux espera `/work/canvas`; Windows produce `D:\work\canvas`. La lógica por defecto de workspace hermano es nativa, pero la suite raíz queda roja. |
| CMD / procesos | **Fallo confirmado** | `execFileSync('npx.cmd', ...)` produce `spawnSync EINVAL`; rompe opción 4 subopciones 1, 3 y 4 interna. El `catch` oculta causa/código. |
| Entrada interactiva | **Fallo en modo pipe** | Varias instancias `readline` pierden respuestas al canalizar respuestas hacia `npm start`; afecta CI/automatización por CMD. |
| Node nativo | **Aprobado parcial** | Node 24/npm 11 correctos; instalación, lint, build y suites aisladas funcionan. No se probó Node 20, versión mínima declarada. |
| Docker Desktop | **No verificable en runtime** | CLI/Compose presentes; daemon `desktop-linux` apagado. Cuatro configuraciones Compose validan sintaxis. No se inspeccionaron ni alteraron contenedores. |
| Seguridad Docker | **Riesgo alto** | Tras fallar `compose up`, el instalador ejecuta `docker compose down` sin confirmación (`CanvasCloner.js:145-147`). Aunque no agrega `-v`, elimina contenedores/red del proyecto y viola la política solicitada. No se ejecutó. |
| Compose dev | **Riesgo estático** | El override dev sustituye el comando del contenedor por `npm run dev` (Vite); debe verificarse que backend/puerto 3000 sigan disponibles en el diseño final. No hubo runtime. |
| Certificados | **Bloqueado** | `mkcert` y `winget` no disponibles, certificados ausentes y hosts sin `canvas.docker`. Las unidades del bootstrap pasan, pero no prueban instalación/confianza real. El “cert existente” no revalida que la CA continúe confiada. |
| Navegador predeterminado | **Parcial** | La unidad del resolver pasa y el código usa `cmd.exe /d /s /c start "" URL`. No se abrió un navegador por ser una acción externa; la asociación real del usuario no pudo leerse en este contexto. |
| Permisos | **Aprobado parcial** | ACL permite escritura del proyecto. La primera instalación npm restringida falló al escribir `D:\DevCaches\npm\_logs`; la ejecución con permisos normales terminó. |
| Puertos | **Aprobado al cierre** | 3000/5173/8443 sin listener. El E2E falla precisamente porque 8443 no está servido. |
| Logs | **Aprobado parcial** | Se generó `logs/server.1.log`, ignorado por Git, con JSON y rutas Windows. Registra fallos simulados de webhook/email; no se detectó secreto. No hubo rotación/carga prolongada. |
| Mensajes/encoding | **Riesgo** | Algunos artefactos Playwright muestran texto UTF-8 como mojibake (`DeberÃ­a`). Los archivos están versionados LF y la terminal puede depender de codepage. Debe probarse con `chcp` habitual de CMD. |
| Finales de línea | **Aprobado estático** | `.gitattributes` fuerza LF; archivos clave reportan `i/lf w/lf`. Adecuado para Docker, pero no se probó un checkout nuevo bajo `core.autocrlf` diferente. |
| Diagnóstico | **Desalineación** | `npm run diagnose` exige `GEMINI_API_KEY` en entorno, mientras la app actual gestiona llaves IA en DB mediante `IAConfigManager`; puede producir un falso requisito tras la refactorización. |
| Apagado | **Parcial** | Existe manejo especial de Ctrl+C para CMD. No se hizo prueba prolongada de cierre de backend/Vite/Docker. |

## 9. Versionado, cachés, secretos y artefactos

Comandos seguros ejecutados:

```bat
git ls-files "*/node_modules/*"
git clean -ndX
git ls-files --eol package.json apps/installer/src/orchestration/testRunner.js apps/installer/src/orchestration/cli.js
git grep -n -I -E "BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|AIza[0-9A-Za-z_-]{20,}|sk-[0-9A-Za-z_-]{20,}"
```

Resultados:

- Cero archivos `node_modules` versionados actualmente. La sincronización reciente retiró dependencias que sí aparecieron en commits históricos.
- `.gitignore` cubre dependencias, builds, Vite, coverage, `.env`, certificados, logs, Playwright y estado de setup.
- Artefactos locales ignorados generados por esta auditoría: `node_modules/`, `apps/client/node_modules/`, `apps/server/node_modules/`, `dist/`, `logs/` y `apps/client/test-results/`.
- No se eliminaron estos artefactos porque no se autorizó eliminación.
- No se encontraron llaves privadas ni tokens con los patrones revisados en el árbol versionado actual. `apps/server/src/config/secrets.js` es un registro de secretos, no un secreto embebido.
- Esto **no certifica el historial Git**. `docs/GITLEAKS.md`/`docs/TECHNICAL_DEBT.md` registran hallazgos históricos de llaves privadas y rotación pendiente. No se dispuso/ejecutó Gitleaks en esta fase.

Estado Git inmediatamente antes de crear este informe: `## main...origin/main`, limpio. Después de crearlo, el cambio esperado es únicamente este Markdown no versionado; los artefactos anteriores permanecen ignorados.

## 10. Comandos exactos y seguros para reproducir

### 10.1 Línea base y entorno

```bat
cd /d "D:\Descargas\Proyecto Plugin feedback\Plugin-Feedback-Canvas"
git status
git branch --show-current
git rev-parse HEAD
where node
node --version
npm --version
where docker
docker --version
docker compose version
docker context show
```

### 10.2 Dependencias, calidad y pruebas sin servicios externos

```bat
npm ci
npm ls --depth=0
npm test
npm run lint
npm run build
npm run test:client
npx --no-install vitest run apps/server/tests/
npm run diagnose
```

`npm ci` y `build` crean artefactos ignorados; no modifican archivos versionados. `npm run diagnose` es de lectura salvo sus logs.

### 10.3 Opción 4 desde CMD

```bat
npm start
```

Introducir `4`, luego `1`. Para reproducir solo el defecto de proceso Windows sin entrar al menú:

```bat
node -e "const {execFileSync}=require('node:child_process');try{execFileSync('npx.cmd',['--no-install','vitest','--version'],{stdio:'inherit'});console.log('OK')}catch(e){console.error(e.code,e.errno,e.syscall);process.exit(1)}"
npx --no-install vitest --version
```

El primer comando falla dentro de `execFileSync`; el segundo funciona resuelto por CMD.

### 10.4 Compose estático, sin arrancar ni eliminar recursos

```bat
docker compose -f docker-compose.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.dev.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.prod.yml config --quiet
docker compose -f docker-compose.db.yml config --quiet
```

No ejecutar `docker compose down`, `docker system prune`, `docker volume rm`, `docker image rm` ni limpieza equivalente sin autorización.

### 10.5 E2E, solo cuando Canvas local ya esté levantado de forma autorizada

```bat
npx --no-install playwright install chromium
npm run test:e2e
```

Para Canvas real, no ejecutar hasta disponer de una cuenta sandbox y autorización para usarla. Las variables esperadas por el runner son `CANVAS_URL`, `CANVAS_TEST_USER`, `CANVAS_TEST_PASS` y `CANVAS_TEST_COURSE_ID`. No usar una cuenta productiva.

### 10.6 Reproducción segura por bug

| Bug | Comando/prueba segura actual | Qué falta para prueba concluyente |
|---:|---|---|
| 1 | `npx --no-install vitest run apps/server/tests/unit/audit-regressions.test.js -t "aprobacion masiva"` | PostgreSQL + Canvas mock y E2E React seleccionando `EDITADO` |
| 2 | `npx --no-install vitest run apps/server/tests/unit/audit-regressions.test.js -t "sola aprobación concurrente"` | Test de componente del modal y doble clic |
| 3 | `npx --no-install vitest run apps/server/tests/unit/audit-regressions.test.js` | DB real/efímera y recarga de UI |
| 4 | `npx --no-install vitest run apps/server/tests/unit/audit-regressions.test.js -t "view_feedback"` | Migración PostgreSQL y login estudiante |
| 5 | `npx --no-install vitest run apps/server/tests/unit/file-controller.test.js` | E2E de navegación + Gotenberg controlado y métricas de concurrencia |
| 6 | No existe prueba ejecutable | Implementación/fixtures de campañas |
| 7 | `npx --no-install vitest run apps/server/tests/unit/audit-regressions.test.js -t "notificacion"` | Sandbox de correo y eventos de campaña; sin envío real |
| 8 | No existe prueba RF64 | Matriz UI/API con IA activa/inactiva/sin llave |
| 9 | `npx --no-install vitest run apps/server/tests/unit/audit-regressions.test.js -t "nombre del estudiante"` | Canvas sandbox o gateway contractual |
| 10 | No ejecutar creación actual: escribe source | Entorno efímero autorizado y E2E tras rediseño persistente |

Los filtros `-t` dependen del texto exacto vigente; si un filtro no encuentra tests, ejecutar el archivo completo y confirmar el nombre con `npx vitest list` antes de interpretar el resultado.

## 11. Elementos no verificables en esta fase

- Arranque real de Docker Compose, salud de PostgreSQL/Gotenberg/Canvas y persistencia DB.
- Registro y launch LTI completo desde Canvas local o real.
- Confianza del certificado en Windows y apertura del navegador predeterminado.
- Entrega real RF42/RF44 por un proveedor de correo. No se intentó.
- Importación de campañas: no existe una implementación identificable.
- RF06 extremo a extremo: el endpoint actual habría escrito código.
- Comportamiento multiusuario, reinicio del proceso durante un lote y reintentos después de caída.

Estas limitaciones no convierten en aprobados los comportamientos; mantienen los estados parciales/no corregidos indicados.

## 12. Plan priorizado de correcciones propuesto

1. **P0 — Windows/opción 4:** reemplazar el lanzamiento de `npx.cmd` por una estrategia compatible con Windows (`cmd.exe /d /s /c` con argumentos cuidadosamente escapados, o API/binario JS directo), conservar error/código original y añadir prueba Windows. Hacer el menú automatizable con una única interfaz de entrada.
2. **P0 — Evitar destrucción implícita:** retirar o pedir confirmación explícita antes de `docker compose down`; registrar el proyecto/recursos exactos. No tocar volúmenes.
3. **P0 — Bug 5:** eliminar el `reset-active` al leer/navegar; corregir lifecycle del visor PDF y agregar caché/deduplicación/límites Gotenberg.
4. **P0/P1 — Bugs 6–7:** recuperar/implementar campañas y definir RF42/RF44; conectar un proveedor sandbox/productivo mediante outbox y pruebas sin correo real.
5. **P1 — Bug 8:** contrato de capacidad IA y fallback automático solo lectura, con estados loading/error saneados.
6. **P1 — Bugs 1–3:** job durable de envío masivo; reparar flujo alternativo de confirmación; reforzar autorización y prueba DB de notas.
7. **P1 — Bug 9:** normalizar IDs Canvas/LTI y no mostrar/enviar ID como nombre ante fallos.
8. **P1 — Bug 10:** persistir variables en DB o un registro controlado, sin escribir el source en runtime; completar E2E RF06.
9. **P1 — Pruebas:** corregir la expectativa portable de rutas; sustituir `expect(true)` E2E por aserciones de negocio; hacer que opción 4 ejecute instalador+backend+cliente y reporte skips explícitos.
10. **P2 — Setup Windows:** alinear `doctor` con IA en DB, probar `mkcert`/trust/hosts/browser con fixtures y documentar codepage/UTF-8 de CMD.

## 13. Decisión de salida

No se recomienda declarar los diez bugs corregidos ni aprobar la opción 4 para Windows en el commit auditado. No se ha realizado ninguna corrección de código o configuración. Se requiere autorización explícita antes de iniciar la fase de cambios, levantar/crear recursos Docker que luego deban eliminarse, usar Canvas/correo sandbox o limpiar artefactos generados.
