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
