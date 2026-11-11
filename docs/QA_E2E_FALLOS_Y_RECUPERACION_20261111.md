# QA E2E de fallos, protección y recuperación — 11/11/2026

**Clon único autorizado:** `/home/jaime/proyectos/Plugin-Feedback-Canvas-feedback-cualitativo`
**Rama:** `main`. **Publicación:** exclusivamente commits locales, sin push.
**Límite:** no modificar el menú interactivo ni repositorios, contenedores o volúmenes históricos.

## Objetivo y criterio de aceptación

Una verificación real de recuperación necesita: (1) control saludable anterior,
(2) fallo real observado, (3) detección o reparación segura, (4) nuevo flujo
saludable y (5) integridad y limpieza. Los informes **no** presentan una prueba
de integración simulada, un FK SQL ni un inventario de shards como prueba de
un incidente HTTP espontáneo del profesor.

La suite `tools/qa/failure_recovery_e2e.py` ejecuta escenarios existentes y
nuevos con estados separados:

- `PASS_BASELINE`: regresión del camino saludable.
- `PASS_SAFE_BLOCK`: el sistema evita la operación peligrosa.
- `PASS_RECOVERED`: recuperación real verificada.
- `INTEGRATION_ONLY`: código real de orquestación, dependencias simuladas.
- `NOT_VERIFIED`: no existen precondiciones para certificar E2E auténtico.
- `FAIL`: se incumple un criterio o falta alguna evidencia necesaria.

La suite escribe resultados progresivamente en JSON fuera de Git; un código de
salida cero significa **sin fallos detectados en las pruebas ejecutadas**, no
que todos los escenarios estén certificados. El campo
`allScenariosFullyCertified` solamente puede ser `true` si realmente no
quedan escenarios simulados o no verificados.

## Matriz de pruebas

| Escenario | Tipo de evidencia | Política de recuperación |
| --- | --- | --- |
| Login del profesor + LTI/OAuth de administrador/profesor | Canvas Rails y navegador real con PostgreSQL y backend desechables | Mantener acceso normal y verificar cursos HTTP 200 después de OAuth |
| Referencias inválidas en `terms_of_services` | FK auténtica PostgreSQL, en una **copia completa**, sin COMMIT | Bloqueo de la transacción; no inventar ni reescribir cuentas |
| Control de cuenta válida + segunda pasada de LTI | Inserción transaccional válida que se revierte, más otro E2E real | Demostrar que se conserva la integridad y el flujo de login |
| Contenedor de Plugin detenido, solo si es propio | Docker real con etiquetas de propiedad y consentimiento | `docker start` limitado, sin recrear contenedores/volúmenes |
| Conflicto de puerto con proceso ajeno | Listener TCP real | No terminar procesos ajenos |
| Reinicio de Canvas web | Copia completa de Canvas, huellas SQL y navegador real | Recuperación de disponibilidad; NO equivale a reinstalación |
| Instalación de Canvas interrumpida | `EnvironmentSetup` real y archivos temporales, externos simulados | Reanudar sin pérdida de artefactos; **INTEGRATION_ONLY** |
| Migraciones de una versión antigua auténtica | Inventario de código/base de QA de solo lectura | **NOT_VERIFIED** mientras no exista origen histórico diferente |
| Múltiples shards reales | Inventario de `switchman_shards` del QA | **NOT_VERIFIED** sin infraestructura Switchman multishard válida |
| Regresiones completas | Python, Vitest y lint | El sistema no debe introducir nuevos errores |

### Falla FK: qué sí y qué no demuestra

`tools/qa/disposable_canvas_faults.py` solo acepta PostgreSQL con nombre
`qa-hpair-<12 hex>-db`, etiqueta de recurso desechable y propietario coincidente.
Comprueba primero que `fk_rails_337ba633a9` está validada y enlaza
`terms_of_services` con `accounts`. Guarda huellas de cuentas, términos,
shards y migraciones. Ejecuta intentos de escritura con `BEGIN` y `ROLLBACK`,
identificadores negativos que no consumen secuencias, y **ningún COMMIT**.
Incluye dos referencias que no existen y una referencia válida elegida de
los datos propios de esa copia. Verifica que las huellas son idénticas antes
y después. El proceso habitual de login Rails **no** se instrumenta ni modifica.

Una excepción FK PostgreSQL producida por esta prueba **no prueba** la
procedencia del `account_id` del profesor. Su causa solo puede atribuirse
mediante reproducción natural en el login o trazas autorizadas de su servidor.

### Recuperaciones permitidas

El instalador ya puede reinstalar una vez dependencias Node ausentes y
recuperar contenedores de PostgreSQL/Gotenberg **propios y detenidos**, con
identidad verificada y consentimiento explícito. No inicia contenedores
históricos, no reescribe `accounts`, `terms_of_services`, shards ni el
historial de migraciones de Canvas; si la operación no es inequívocamente
segura, informa y bloquea.

## Ejecución completa

El script usa herramientas en `tools/qa`, sin abrir `npm start` ni
seleccionar una opción del menú:

```bash
cd /home/jaime/proyectos/Plugin-Feedback-Canvas-feedback-cualitativo
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"
export QA_ALLOW_FAILURE_RECOVERY_E2E=true
export QA_ALLOW_FULL_LTI_E2E=true
export QA_ALLOW_HISTORICAL_FULL_STACK=true
export QA_ALLOW_ISOLATED_PLUGIN_BACKEND=true
export QA_ALLOW_CANVAS_RESTART_E2E=true
export QA_ALLOW_DISPOSABLE_COMPAT_TESTS=true
export PLUGIN_TEST_MODE=true
export PLUGIN_QA_NO_BROWSER=true

python3 tools/qa/failure_recovery_e2e.py \
  --mode full --pair august \
  --report "$HOME/qa-feedback-20261110/artifacts/qa-failure-recovery-matrix-20261111.json"
```

`--mode light` ejecuta solo las verificaciones más breves; **no** equivale al
E2E integral. Cada prueba que inicia Docker verifica identidades y elimina
únicamente los recursos desechables que ella misma creó.

## Precondiciones pendientes

Para cerrar al 100 % la matriz son necesarios **entornos reales autorizados**
y no sintéticos: un Canvas con múltiples shards funcionales, un origen y destino
de migraciones de distintas versiones, y un Canvas instalado desde cero cuya
instalación completa se interrumpa y reanude. Estas pruebas solo pueden aprobarse
cuando se haya observado la operación real, la recuperación y su regresión.
No se crearán shards ficticios ni se migrarán bases históricas originales para
hacer aparecer un falso PASS.

## Ejecución verificada del 11 de noviembre de 2026

**Informe final:** `~/qa-feedback-20261110/artifacts/qa-failure-recovery-matrix-v2-20261111.json`.

- **10 escenarios integrados ejecutados, 0 fallos.** Tres escenarios permanecen
  correctamente identificados como no certificados: instalación completa
  interrumpida (integración solamente), upgrade Canvas auténtico y multishard.
- **FK SQL real:** dos referencias ausentes rechazadas por
  `fk_rails_337ba633a9`, control positivo de referencia existente aceptado,
  transacciones revertidas y huellas de datos idénticas.
- **Regresión E2E de LTI/OAuth:** administrador y profesor pasaron **antes y
  después** del experimento FK, incluyendo callback OAuth 302 y cursos HTTP 200.
  No se reprodujo naturalmente el incidente del profesor.
- **Recuperación Docker:** 7/7 controles de servicios propios detenidos,
  consentimiento y bloqueos de seguridad; recursos temporales eliminados.
- **Canvas web:** reinicio real del servicio desechable, login headless
  posterior e integridad PostgreSQL preservada.
- **Python QA:** 113 pruebas aprobadas; **JavaScript:** 451 aprobadas,
  21 omitidas; **lint:** aprobado; **build Vite:** aprobado. Build señala
  únicamente advertencia de tamaño de ciertos bundles, no falla funcional.
- **Históricos:** sin modificaciones; **Git:** commits únicamente locales,
  ningún push. El menú interactivo no se modificó.

El informe se mantiene deliberadamente con `allScenariosFullyCertified=false`
hasta que existan los tres laboratorios auténticos pendientes.
