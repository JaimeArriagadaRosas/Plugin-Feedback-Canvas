# Diagnóstico de Canvas — opción [6] (solo lectura)

**Fecha:** 11 de noviembre de 2026.

Esta opción se encuentra en el submenú de pruebas, sin alterar las demás opciones:

```text
npm start
[4] Validaciones de Caja Negra
[6] Diagnóstico de Canvas (solo lectura)
```

## Qué inspecciona

- Disponibilidad de los archivos y versión Git de Canvas.
- Identidad de los contenedores `postgres`, `web` y `redis` de Canvas: etiquetas Compose, directorio de proyecto y estado.
- Catálogo de Canvas: presencia de cuentas, términos, shards e historial de migraciones. Si faltan tablas básicas, detiene las consultas detalladas y muestra CANVAS-DB-SCHEMA-001 sin intentar reparaciones.
- Historial de versiones de Canvas: compara archivos de `db/migrate` con `schema_migrations` mediante consultas de solo lectura. Los códigos CANVAS-DB-HISTORY-OK, CANVAS-DB-HISTORY-PENDING y CANVAS-DB-HISTORY-UNKNOWN distinguen coincidencia, versiones pendientes y versiones desconocidas. No ejecuta migraciones.
- Base `canvas_development`: cantidad de cuentas, cuentas raíz, términos de servicio, referencias huérfanas, restricción FK de términos, FK pendientes de validar y tabla/cantidad de shards.
- Muestra limitada de los logs recientes del contenedor web (hasta 350 líneas de las últimas 24 horas). Si existe un error reconocible con `account_id`, comprueba si la referencia existe en `accounts` de la base consultada, **sin guardar ni mostrar el ID**.

**No modifica la información de Canvas.** Emplea `docker compose ps`, `docker inspect`, `docker logs`, `git rev-parse` y `psql` con `PGOPTIONS='-c default_transaction_read_only=on'` y `BEGIN TRANSACTION READ ONLY`. No hace `compose up`, `npm start` adicional, migraciones, `Rails runner`, `docker start`, reinicios ni operaciones SQL de escritura.

## Si Canvas no está disponible

La opción genera un informe **incompleto** e indica qué contenedores no estaban disponibles. **No los inicia ni reinstala nada.** Para obtener un diagnóstico completo, el administrador debe decidir previamente cómo levantar su entorno; el diagnóstico nunca lo hace.

## Informes y privacidad

Los resultados se muestran resumidos en consola y se guardan en:

```text
logs/canvas-diagnostics/canvas-readonly-<fecha>-<id>.json
```

El directorio `logs/` no se versiona. Los archivos se escriben con permisos `0600` en plataformas compatibles. No se incluyen contraseñas, tokens, cookies, líneas completas de Rails ni identificadores de cuentas obtenidos del error. Antes de compartir un informe debe revisarse su contenido y eliminar datos de infraestructura considerados internos.

Las observaciones son **indicadores**, no una demostración automática de la causa raíz. Que una referencia global no exista como ID local no basta por sí solo para confirmar un fallo de shards. Que un error no aparezca en las últimas 350 líneas tampoco demuestra que nunca ocurriera.

## Validación

- `apps/installer/tests/unit/canvas-readonly-diagnosis.test.js`: permisos, selección del contenedor correcto, SQL de solo lectura, redacción y fallos de disponibilidad.
- `apps/installer/tests/unit/canvas-readonly-menu.test.js`: opción 6 accesible sin modificar las opciones 1–5.
- Validación manual en WSL: Canvas detenido genera informe parcial sin iniciar servicios; laboratorio Canvas activo permite verificar PostgreSQL mediante consultas exclusivamente de lectura.

La función principal es `diagnoseCanvasReadOnly` en `apps/installer/src/diagnostics/CanvasReadOnlyDiagnosis.js`.

Las advertencias DOCKER_REDIS_STOPPED y CANVAS-REDIS-001 indican Redis detenido o no saludable; ninguna realiza reinicios. CANVAS-DB-SCHEMA-002 indica ausencia del historial de migraciones. La detección de un esquema antiguo no implica que esté validada su actualización.

## Interpretación general y resumen copiable (ampliación del 11/11/2026)

La opción [4] → [6] **mantiene intactas las comprobaciones técnicas y el mensaje de solo lectura**.
A continuación del resultado y de la ruta al informe JSON aparece un bloque nuevo:

- **RESUMEN TÉCNICO PARA SOPORTE (COPIAR)**: identificador anónimo del diagnóstico, fecha UTC, estado, código principal y otros códigos relevantes, conteo de verificaciones, revisiones Git de Plugin Feedback y Canvas, salud de los servicios, cuentas raíz, términos huérfanos, FK pendientes, migraciones, número de shards y detección acotada de fallos FK en los logs. No muestra el ID de la cuenta del error, solo si la referencia aparece o no en la tabla local.
- **INTERPRETACIÓN DEL DIAGNÓSTICO**: explicación general, impersonal, en lenguaje comprensible, derivada de códigos verificables y nunca del texto sin depurar de los logs.
- **SIGUIENTE PASO RECOMENDADO**: actuación segura, específica para el tipo de anomalía. Únicamente los servicios detenidos de un entorno local administrado por Plugin Feedback pueden sugerir el arranque normal mediante opción 3; no se recomienda esa opción como solución de una FK, un historial de migraciones desconocido o una instalación externa.

El mismo bloque se guarda estructurado como `support` dentro del JSON. Se incluye `diagnosticId`, también incorporado al nombre del archivo, para correlacionar un texto copiado con el informe original sin tener que copiar rutas absolutas ni información de usuarios. `pluginRevision` y `canvasRevision` se obtienen únicamente con `git rev-parse`; si no están disponibles se muestra «no evaluada». Un `git status --porcelain --untracked-files=no` de lectura informa únicamente si existen **cambios locales en archivos versionados**, sin copiar rutas o diffs; este indicador permite anticipar posibles conflictos antes de un `git pull`.

**Mejora mínima de los indicadores**: se advierte explícitamente con `CANVAS_LAST_FK_ERROR` si una muestra reciente contiene una excepción FK en términos de servicio, incluso si la cuenta referida aparece en la tabla local. La verificación del constraint ahora relaciona exactamente `terms_of_services` con `accounts` y exige validación. Estas comprobaciones no verifican asociaciones reales entre shards.

**Interpretación conservadora**: «saludable» solo significa que las comprobaciones disponibles no encontraron problemas. Los logs abarcan únicamente hasta 350 líneas de las últimas 24 horas; no detectar una excepción no prueba que no haya existido. Un dato no verificable se señala como tal. Nunca se atribuye el fallo de login a un shard sin una verificación específica de sus asociaciones.

### Política de privacidad y seguridad del texto compartido

El bloque nuevo **no interpola mensajes de excepción, líneas originales de Rails, nombres de cuenta, tokens, cabeceras, cookies, credenciales ni números de ID de usuarios**. Incluye solo códigos enumerados, valores numéricos verificados y revisiones de Git validadas como hexadecimales. El identificador del diagnóstico es aleatorio. El informe completo continúa guardándose localmente con permisos restrictivos, y se recomienda revisarlo antes de compartirlo.

Se preservan todas las operaciones de solo lectura: `docker compose ps`, `docker inspect`, `docker logs`, `git rev-parse`, `git status` y transacciones `psql` READ ONLY. **Ni el diagnóstico ni la interpretación reinician contenedores, ejecutan migraciones ni realizan reparaciones.**

### Regresiones

- `canvas-diagnosis-interpreter.test.js`: mensajes por categoría, orientación condicionada a entorno local, límites, prioridades y no divulgación de texto hostil.
- `canvas-readonly-diagnosis.test.js`: FK recientes aunque el account_id esté presente o no exista en la muestra; relaciones exactas del catálogo; persistencia del resumen y consultas de solo lectura.
- `canvas-readonly-menu.test.js`: conservación del menú y correspondencia entre la salida copiable y el JSON generado.

La salida permite identificar la revisión concreta de Plugin Feedback antes de preparar una corrección y verificar el resultado después de un `git pull`, pero **no promete que una actualización pueda reparar por sí sola un problema de datos o del servidor externo**.
