# Laboratorio histórico de compatibilidad — 11/11/2026

## Objetivo y límites

Se aprovecharon copias de código y volúmenes de PostgreSQL antiguos de la máquina para probar **instalaciones reales previamente conservadas** sin cambiar el flujo habitual de Plugin Feedback.

**Repositorio único de implementación:** `/home/jaime/proyectos/Plugin-Feedback-Canvas-feedback-cualitativo`, rama española `main`.

**No se editó el menú interactivo.** Los clones antiguos son referencias de **solo lectura**. Los archivos de ejecución, contenedores y volúmenes nuevos son estrictamente temporales; los resultados se almacenan en `/home/jaime/qa-feedback-20261110/artifacts/historical-compat`, fuera de Git.

## Infraestructura reutilizable

- `tools/qa/historical_compatibility_lab.py`: inventario, verificación de sintaxis, compilación temporal y pruebas de datos históricos clonados.
- `tools/qa/historical_matrix.py`: clasificación verificable de resultados. Separa `PASS`, `SAFELY_BLOCKED`, `BLOCKED`, `NOT_RUN` y `FAIL`; no inventa un E2E de autenticación.
- `tools/qa/tests/test_historical_compatibility_lab.py`: autorización, rutas, extracción sin secretos, verificación de identidad Docker, compatibilidad PG14 y limpieza tras fallos.
- `tools/qa/tests/test_historical_matrix.py` y `tools/qa/tests/test_historical_shapes_fixture.py`: clasificación, no falsos positivos y regresión mediante datos estructurales **sintéticos y sanitizados**.
- `tools/qa/fixtures/historical_schema_shapes.json`: casos estructurales reproducibles incluso si posteriormente se eliminan los repositorios antiguos. **No contiene datos reales de cuentas, claves o contraseñas.**

### Ejecución (comandos, sin agregar opciones al menú)

```bash
cd ~/proyectos/Plugin-Feedback-Canvas-feedback-cualitativo
export QA_ALLOW_HISTORICAL_COMPAT=true
export PLUGIN_TEST_MODE=true
export PLUGIN_QA_NO_BROWSER=true
QA_DIR=~/qa-feedback-20261110/artifacts/historical-compat

python3 tools/qa/historical_compatibility_lab.py \
  --mode inventory --report "$QA_DIR/inventory.json"
python3 tools/qa/historical_compatibility_lab.py \
  --mode syntax --name august-main --report "$QA_DIR/august-main-syntax.json"
python3 tools/qa/historical_compatibility_lab.py \
  --mode build --name august-main --report "$QA_DIR/august-main-build.json"
python3 tools/qa/historical_compatibility_lab.py \
  --mode volume --name august-canvas-db --report "$QA_DIR/august-canvas-db-integrity.json"
python3 tools/qa/historical_matrix.py --output "$QA_DIR/historical-matrix.json"
```

Las otras referencias disponibles se llaman `october-validation`, `october-lint`, `october-original`, `october-canvas-db` y `october-alternate-db`.

## Hallazgos reales

### Código histórico (4 variantes)

| Referencia | Rama de origen | SHA corto | Validación de sintaxis | Build de archivo temporal |
|---|---|---|---|---|
| Agosto 2026 | `main` | `9d0be6f` | Aprobada (312 JS) | Aprobado |
| Octubre, validación | `feat/arreglos-y-opcion-5` | `51510a3` | Aprobada (319 JS) | Aprobado |
| Octubre, lint | `fix/eslint-spanish-ci` | `c24d874` | Aprobada (346 JS) | Aprobado |
| Octubre, original | `feat/arreglos-y-opcion-5` | `a83d9ef` | Aprobada (319 JS) | Aprobado |

Los archivos se obtuvieron mediante `git archive HEAD`, no `git checkout` ni modificación del árbol antiguo. Se excluyeron `.env`, `.npmrc`, `node_modules` y enlaces que salieran del archivo. Las instalaciones `npm ci --offline --ignore-scripts` no disponían de todos los paquetes en caché; para compilar se **copiaron independientemente** las dependencias históricas en una carpeta QA, sin enlaces ni hardlinks hacia los repositorios originales. El build se realizó en esa carpeta y se eliminó al terminar.

**Compilar no demuestra por sí solo que un plugin antiguo se autentique correctamente ni que sea compatible con una base histórica.**

### Datos antiguos PostgreSQL 14 (tres volúmenes)

| Contenedor original (detenido) | Resultado de copia PG14 | Cuentas | Términos | Shards | Migraciones |
|---|---|---:|---:|---:|---:|
| `canvas-lms-main-video-clean-postgres-1` | PASS | 5 | 3 | 1 | 94 |
| `canvas-lms-master-postgres-1` | PASS | 8 | 6 | 1 | 94 |
| `plugin-feedback-canvas-postgres-1` | SAFELY_BLOCKED | — | — | — | — |

Las dos primeras copias tienen **cero** términos huérfanos, cero restricciones foráneas pendientes de validación y una FK de términos; el identificador global del error no se almacena como ID local en `accounts`.

La tercera contiene una base `canvas_development` sin las cuatro tablas fundamentales `accounts`, `terms_of_services`, `switchman_shards` y `schema_migrations`. **No se creó el esquema ni se ejecutaron migraciones**: es un caso real de base incompleta que debe detectarse y bloquearse.

Las tres copias se inspeccionaron usando imágenes compatibles con **PostgreSQL 14**, contenedores nuevos con **red deshabilitada**, sin publicación de puertos, y consultas PostgreSQL dentro de transacciones de solo lectura. Los orígenes se montaron explícitamente **read-only** durante la copia. Cada volumen y contenedor efímero se eliminó tras la prueba. **Todos los originales siguen detenidos e intactos.**

### Matriz consolidada

- **10/10 comprobaciones positivas aprobadas**: 4 de sintaxis, 4 de build y 2 de lectura de bases coherentes.
- **1/1 bloqueo seguro confirmado**: base histórica sin el esquema de Canvas requerido.
- **0** recursos Docker efímeros pendientes.
- Las 3 bases originales siguieron sin iniciarse.

Informe completo, inspeccionable localmente:

`/home/jaime/qa-feedback-20261110/artifacts/historical-compat/historical-matrix-20261111.json`

## ¿Qué no queda resuelto todavía?

1. **Actualización real de Canvas**: los volúmenes antiguos observados tienen las mismas 94 migraciones que el código Canvas del laboratorio. No constituyen un ejemplo de actualización oficial entre versiones distintas; sería necesario conseguir una versión de código y una base históricos realmente diferenciados.
2. **Multi-shard auténtico**: las copias comprobadas solo tienen un shard. No se debe fabricar un segundo shard insertando IDs arbitrarios.
3. **Error exacto del profesor**: no se reprodujo mediante un inicio de sesión natural de Rails. El bloqueo de un esquema vacío no demuestra que haya provocado esa excepción de FK.
4. **Login/LTI combinando código antiguo y bases antiguas**: aquí se validaron build y datos históricos separadamente; **no se ejecutó un Canvas completo ni un login antiguo contra cada par de datos**. Ese E2E requiere crear una red aislada y los servicios completos compatibles con su versión, usando únicamente bases clonadas.
5. **Instalación completa interrumpida**: siguen disponibles las pruebas existentes de reanudación de `EnvironmentSetup`, pero no una instalación completa de Canvas interrumpida y reiniciada en Docker.

Estas limitaciones permanecen visibles en los informes. **No se habilitó ninguna reparación automática nueva sobre datos de Canvas.**

## Condiciones antes de eliminar los proyectos antiguos

Los tests con archivos estructurales sanitizados permanecerán ejecutables después de eliminar las copias, pero para volver a reproducir **pruebas reales de compatibilidad histórica** hacen falta las fuentes Git y los datos originales. Antes de su futura eliminación conviene conservar un respaldo verificable y protegido **fuera del repositorio público**. Esta ejecución no guardó datos de cuentas en Git ni respaldos persistentes de los volúmenes históricos; las copias de PostgreSQL fueron temporales.

## Seguridad y flujo normal

No hubo `git checkout`, `git reset`, `git clean`, `docker start`, migraciones, `docker compose down -v` ni escritura sobre las copias antiguas. Las eliminaciones se limitaron a contenedores y volúmenes nuevos con etiquetas de propiedad QA y nombres aleatorios. El código de los nuevos tests y utilidades permanece exclusivamente en el clon unificado; **ninguna parte del menú interactivo fue modificada**. Solo se harán commits locales hasta contar con autorización explícita de publicación.
