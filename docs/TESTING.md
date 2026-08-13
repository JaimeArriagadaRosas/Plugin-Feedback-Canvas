# Estrategia de pruebas

El proyecto usa varias capas. «Pasó el test» solo es útil si se identifica qué dependencias fueron reales y cuáles se simularon.

## 1. Comandos

| Comando | Cobertura principal | Requisitos |
|---|---|---|
| `npm run lint` | reglas ESLint del backend | dependencias instaladas |
| `npm test` | suite Vitest del repositorio | Docker para los tests con Testcontainers |
| `npm run test:backend` | tests bajo `apps/server/tests` | Docker para integración incluida |
| `npm run test:integration` | smoke PostgreSQL efímero | daemon Docker accesible |
| `npm run test:client` | Vitest/Storybook en navegador | Chromium de Playwright |
| `npm run test:e2e` | specs Playwright | Vite; Canvas/credenciales según spec |
| `npm run build` | compilación Vite productiva | dependencias instaladas |
| `npm run test:coverage` | cobertura Vitest | mismo runtime que la suite |

Instale de forma reproducible:

```bash
npx --yes npm@11.8.0 ci
```

Para cliente:

```bash
npx playwright install chromium
npx --yes npm@11.8.0 run test:client
```

## 2. Capas

### Unitarias

Prueban reglas, políticas y adaptadores con dependencias inyectadas. Son apropiadas para:

- autorización por rol/contexto;
- validación de versiones y plataforma;
- selección de instaladores;
- seguridad de rutas/procesos;
- configuración Canvas y políticas de memoria;
- factoría/proveedores de IA sin llamadas reales.

Un runner simulado de Docker valida argumentos y decisiones, no demuestra que Docker/Canvas funcionen.

### Integración

`apps/server/tests/integration/backend_smoke.test.js` usa Testcontainers con PostgreSQL. Demuestra que el código puede hablar con una base efímera real y aplicar el smoke esperado.

Requiere:

```bash
docker info
docker compose version
npm run test:integration
```

Si el runtime no está disponible, el resultado es infraestructura faltante, no una aprobación omitida.

### Cliente y Storybook

`npm run test:client` ejecuta pruebas de componentes/historias en Chromium headless. Sirve para renderizado, estados y regresiones de componentes. No valida Canvas, PostgreSQL, correo ni LTI real.

### E2E aislados

`massive-feedback.spec.js` intercepta HTTP con `page.route()`. En su estado actual es un arnés inicial: comprueba que la página abre, pero captura la aserción del título y termina con una condición trivial. `login.spec.js` también es un smoke mínimo.

Estos tests no son todavía una puerta de release. Deben incorporar selectores estables, interacción real y aserciones observables antes de presentarse como cobertura del flujo masivo.

### E2E LTI

`lti-flow.spec.js` abre Canvas, intenta autenticarse, entra al curso y busca la herramienta. En modo local puede omitir la validación del iframe cuando el enlace no aparece; por ello un pass local no siempre prueba el launch completo.

Para un objetivo real se exige configuración explícita:

```bash
E2E_TARGET=real \
CANVAS_URL=https://canvas-staging.example.edu \
CANVAS_TEST_USER=usuario-de-prueba \
CANVAS_TEST_PASS=secreto \
CANVAS_TEST_COURSE_ID=123 \
npm run test:e2e
```

El validador rechaza `localhost`, `.local` y redes privadas cuando `E2E_TARGET=real`. Use únicamente cuentas y cursos de staging; no registre contraseñas en CI logs.

## 3. Baseline conocido de la rama Linux

La validación local registrada el 2026-08-11 obtuvo:

| Evidencia | Resultado |
|---|---:|
| Backend en Ubuntu/WSL2 con Docker rootless | 71/71 |
| Cliente/Storybook Chromium | 12/12; una story de documentación omitida |
| ESLint backend | aprobado |
| Build Vite | aprobado, con advertencia de chunks grandes |
| Setup completo de Canvas local | assets, migraciones, web/jobs/Redis/PostgreSQL y `/login` operativos |

Esta tabla es una línea base, no reemplaza el resultado de CI del commit actual. WSL2 tampoco certifica por sí solo un host Linux físico/VM.

## 4. CI actual

`.github/workflows/security.yml` ejecuta en cada push/PR:

- build con Node 22.12.0 y npm 11.8.0;
- validación de `docker compose config`;
- Gitleaks con historial;
- TruffleHog de secretos verificados;
- ESLint del backend;
- suite Vitest;
- cliente/Storybook con Chromium.

El workflow no ejecuta el E2E LTI real ni el setup completo de Canvas. Esas pruebas pertenecen a una matriz de staging controlada.

## 5. Matriz mínima por tipo de cambio

| Cambio | Evidencia mínima |
|---|---|
| Dominio/backend | lint + test afectado + suite backend |
| UI/componente | test de componente/story + `test:client` + build |
| SQL/repositorio | migración + integración PostgreSQL + rollback documentado |
| Autorización/LTI | unitarias negativas + E2E staging del rol afectado |
| Docker/setup | unitarias de política + ejecución limpia en plataforma afectada |
| Plataforma compartida | Windows + WSL2 + Linux nativo; macOS si cambia su adaptador |
| Producción | build de imagen + migración + health/readiness + smoke LTI + rollback |

## 6. Rendimiento

El repositorio contiene runners de estrés y Autocannon, pero no conserva junto al código un artefacto reproducible que respalde las cifras históricas de 15.000 requests, 1.500 RPS o ausencia de fugas. Por ello esas cifras se retiraron de la documentación normativa.

Un benchmark publicable debe registrar:

- commit, fecha y comando;
- CPU, RAM, sistema operativo y versión de Docker;
- dataset y duración;
- mocks frente a servicios reales;
- percentiles p50/p95/p99, throughput y errores;
- uso de CPU/memoria/pool;
- resultados y artefacto sin datos sensibles.

No ejecute estrés contra Canvas, IA o correo institucional sin autorización y límites acordados.

## 7. Criterio de release

Una release productiva exige, como mínimo:

- CI verde del commit exacto;
- E2E LTI real por rol y curso de staging;
- generación, edición, aprobación y envío individual/masivo verificables;
- correo/notificaciones reales en staging;
- migración desde una copia representativa y rollback probado;
- setup/imagen en Linux nativo limpio;
- observabilidad, backup/restauración y escaneo de seguridad.
