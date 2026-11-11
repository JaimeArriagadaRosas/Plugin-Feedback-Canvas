# Canvas LMS — preflight seguro, interrupciones reales de PostgreSQL y límites de certificación

**Fecha:** 11 de noviembre de 2026.
**Repositorio único:** `~/proyectos/Plugin-Feedback-Canvas-feedback-cualitativo`, rama `main`.
**Control de versiones:** commits locales solamente, sin push; menú interactivo intacto.

## Cambio funcional realizado

En `PreflightChecks.checkCanvasClone()` había una operación `docker compose up -d postgres` usada para verificar si la base de Canvas existía. Ese arranque **modificaba el estado del entorno durante un chequeo**, incluso si su propietario pretendía mantenerlo detenido. Además, cuando la conexión fallaba, el preflight marcaba `missing_canvas_assets`, lo cual podía conducir a la reconstrucción de assets para un problema exclusivamente de PostgreSQL.

Ahora `CanvasDatabasePreflight.checkCanvasDatabasePreflight` solo utiliza:
- `docker compose ps -a -q postgres`, sin iniciar servicios;
- `docker inspect` y verificación estricta de directorio/proyecto/servicio;
- en bases **ya iniciadas**, `docker exec psql` con `PGOPTIONS=-c default_transaction_read_only=on` y `BEGIN TRANSACTION READ ONLY`, que comprueba existencia de `accounts`, `terms_of_services`, `switchman_shards` y `schema_migrations`.

El preflight distingue `ready`, `stopped`, `missing`, `schema_incomplete`, `identity_conflict` y `unavailable`:
- `ready`: continúa sin cambios;
- `stopped`: no lo arranca en preflight; permite que el flujo **normal de bringup** lo inicie y verifique;
- `schema_incomplete`: falla con `canvas_database_incomplete` y evita la reconstrucción automática;
- `missing`, `identity_conflict` o `unavailable`: bloquea mediante `canvas_database_unverified` sin adivinar la causa.

`EnvironmentSetup` reconoce ambos marcadores de riesgo en Fast Boot y en arranque normal y aborta antes de `_provisionMissing()`. No toca el menú, no resetea volúmenes, no ejecuta migraciones y no sustituye claves de cifrado.

**Consideración para instalaciones nuevas:** `AssetBuilder.setupAssets()` ejecuta `rake db:create db:migrate` **antes** de escribir `.assets_built`. Por ello una base sin esas tablas *después* del marcador es una situación que debe investigarse, no repararse silenciosamente. Un clon recién creado, sin marcador, conserva su flujo inicial de provisión.

## Prueba E2E Docker/PostgreSQL real

`tools/qa/qa_canvas_preflight_recovery_e2e.py` crea un Compose de PostgreSQL 15 con nombre aleatorio `qa-preflight-<12hex>`, directorio temporal privado, volumen nuevo y **sin publicar puertos**. Cada operación verifica propietario Compose y servicio.

En el laboratorio se ejecutaron estas seis transiciones reales:

| Etapa | Observación esperada | Resultado |
|---|---|---|
| Antes de crear el contenedor | `missing` | **PASS** |
| PostgreSQL nuevo sin esquema | `schema_incomplete` | **PASS** |
| Se crean las cuatro tablas de control en QA | `ready` | **PASS** |
| Se detiene intencionalmente el PostgreSQL propio | `stopped`; el preflight no lo levanta | **PASS** |
| Se reanuda el servicio QA | `ready` | **PASS** |
| Una transacción DDL falla; rollback confirmado; se reaplica en QA | `ready`; sin cambios parciales | **PASS** |

Se confirmó `cleanupConfirmed: true` y el borrado de contenedores y volumen **solo del proyecto creado**. El informe E2E se almacena fuera del repositorio en:

`~/qa-feedback-20261110/artifacts/qa-preflight-recovery-e2e-20261111.json`

Para repetirlo desde el clon autorizado:

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"
export QA_ALLOW_CANVAS_PREFLIGHT_REAL_E2E=true
export PLUGIN_TEST_MODE=true
export PLUGIN_QA_NO_BROWSER=true
python3 tools/qa/qa_canvas_preflight_recovery_e2e.py \
  --report "$HOME/qa-feedback-20261110/artifacts/qa-preflight-recovery-e2e-recheck.json"
```

La suite de regresiones `tools/qa/failure_recovery_e2e.py` integra este escenario.
El probe `tools/qa/canvas_preflight_probe.mjs` solo acepta rutas temporales autorizadas y devuelve códigos/salud, sin exportar credenciales.

### Prueba adicional contra instalaciones ya existentes (solo lectura)

Se ejecutó el mismo `CanvasDatabasePreflight` sin operaciones Docker de escritura:
- Desde `/home/jaime/proyectos/canvas-lms-master`, el Compose activo de
  Canvas devolvió **`ready`** y las cuatro tablas requeridas presentes.
- Desde la copia `~/qa-feedback-20261110/clean/canvas-lms-master`,
  `docker compose ps` resolvió el contenedor perteneciente al proyecto
  `canvas-lms-master` **de otro directorio**. El preflight devolvió
  **`identity_conflict`** y NO consultó su PostgreSQL. Esto demuestra
  un bloqueo útil frente a colisiones de nombres Compose entre clones.

Ambas comprobaciones se realizaron sin iniciar, detener, migrar ni editar
ningún servicio existente. El script temporal de comprobación se eliminó.

## Alcances que aún NO quedan demostrados

- Esta prueba E2E corresponde a **Docker + PostgreSQL reales**, pero crea solo cuatro tablas de laboratorio. **No** es una instalación integral desde cero de Canvas Rails, ni ejecuta las migraciones oficiales.
- Tampoco constituye una actualización entre versiones distintas de Canvas.
- Un shard simulado en una tabla PostgreSQL no equivale a un verdadero entorno Switchman multi-shard ni a una prueba de login entre shards.
- No se reprodujo espontáneamente en `Login::CanvasController#create` la excepción `ActiveRecord::InvalidForeignKey` que observó el profesor.
- No se agregaron correcciones automáticas sobre `accounts`, `terms_of_services` o `switchman_shards`: hacerlas sin determinar la causa real podría dejar la instalación inconsistente.

## Viabilidad examinada para la fase de migraciones y shards

- Los tres árboles históricos locales de Canvas consultados corresponden al mismo commit `2e2b4a46d08e...`. El checkout histórico inspeccionado conserva **un solo commit local**, de modo que no existe un par de revisiones antiguas independientes para realizar el upgrade auténtico sin conseguir otro código/bases autorizados.
- El QA Canvas registra **un solo shard**. El helper original `spec/sharding_spec_helper.rb` omite escenarios de sharding si falta un complemento de multitenencia compatible. No hay justificación para fabricar una segunda fila SQL en `switchman_shards`.
- La auditoría vigente de historial arroja `CANVAS-DB-HISTORY-OK`, **0 versiones pendientes y 0 desconocidas**, después de excluir el archivo de migración solo de tests.
- Interpretar el identificador global aportado por el profesor como un shard concreto sigue siendo una **hipótesis**, no una causa verificada.

Evidencias recientes en `~/qa-feedback-20261110/artifacts/`:
- `qa-phase2-upgrade-preflight-20261111.json`
- `qa-phase3-shards-preflight-20261111.json`

## Validación final de regresiones

- `npm test`: **462 aprobadas, 21 omitidas**, 98 archivos de pruebas aprobados
  y 4 omitidos; ninguna fallida.
- `npm run lint`: aprobado.
- `npm run build`: aprobado; solo advertencia preexistente de paquetes grandes.
- `python3 -m unittest discover -s tools/qa/tests -p 'test_*.py' -q`:
  **119 aprobadas**, ninguna fallida.
- E2E real LTI/OAuth de administrador y profesor en Canvas desechable:
  **PASS ambos roles**, con eliminación de bases y contenedores QA.
  Evidencia: `qa-lti-preflight-regression-20261111.json`.
- Matriz integrada `--mode light`: **7 escenarios ejecutados, 0 fallos**,
  3 no certificados por precondiciones inexistentes; evidencia:
  `qa-failure-recovery-phase2-light-20261111.json`.
- E2E de PostgreSQL preflight propio: `PASS_RECOVERED`, `cleanupConfirmed=true`.
- `git diff --check` y comprobación de cambios acotados al clon único:
  sin alteraciones del menú.

Estos resultados no sustituyen el E2E de upgrade Canvas entre versiones ni
la prueba Rails multi-shard.

## Criterios de cierre

1. Conseguir y autorizar código y volumen antiguo Canvas de **revisiones diferentes**, siempre en QA desechable, para probar `db:migrate` y la regresión real.
2. Preparar un laboratorio Rails/Switchman multi-shard funcional con datos sintéticos antes de afirmar que el fallo FK está relacionado con shards.
3. Realizar una instalación integral desde cero de Canvas en una copia descartable, interrumpir una migración real y demostrar reanudación sin efectos secundarios.
4. Obtener traza sanitizada de solo lectura del entorno del profesor antes de proponer una reparación específica de su base.

Hasta entonces, el comportamiento correcto es **detectar, proteger y bloquear cambios peligrosos**; las recuperaciones limitadas ya demostradas siguen siendo aplicables.
