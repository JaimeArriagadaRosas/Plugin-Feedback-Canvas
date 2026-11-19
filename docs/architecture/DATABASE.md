# Base de datos del Plugin Feedback

Este documento explica dónde se define la persistencia del **Plugin Feedback para Canvas LMS**, cómo se configura PostgreSQL y dónde consultar el esquema y sus migraciones. Complementa la [arquitectura general](ARCHITECTURE.md) y la [configuración del entorno](../setup/ENVIRONMENT.md).

> [!IMPORTANT]
> **Son bases de datos distintas:** la base PostgreSQL del plugin almacena sus propios datos de feedback y configuración. Canvas LMS mantiene su propia base e infraestructura. La opción 3 del instalador puede levantar ambas dentro del entorno local, pero no deben confundirse ni tratarse como un único esquema.

## 1. Ubicación en el monorepo

| Responsabilidad | Ruta relativa a la raíz del repositorio |
|---|---|
| Configuración de conexión del plugin | [`packages/plugin-database/src/connection/databaseConfig.js`](../../packages/plugin-database/src/connection/databaseConfig.js) |
| Migraciones SQL | [`packages/plugin-database/migrations/`](../../packages/plugin-database/migrations/) |
| Ejecución y seguimiento de migraciones | [`packages/plugin-database/src/migrations/MigrationRunner.js`](../../packages/plugin-database/src/migrations/MigrationRunner.js) |
| Punto de entrada de las migraciones | [`packages/plugin-database/bin/migrate.js`](../../packages/plugin-database/bin/migrate.js) |
| Datos sintéticos de desarrollo | [`packages/plugin-database/seeds/seedLocalUsers.js`](../../packages/plugin-database/seeds/seedLocalUsers.js) |
| PostgreSQL local y Gotenberg | [`docker-compose.db.yml`](../../docker-compose.db.yml) |
| Composición base, desarrollo y producción | [`docker-compose.yml`](../../docker-compose.yml), [`docker-compose.dev.yml`](../../docker-compose.dev.yml) y [`docker-compose.prod.yml`](../../docker-compose.prod.yml) |
| Preflight de **la base de Canvas**, no de la base del plugin | [`apps/installer/src/installation/CanvasDatabasePreflight.js`](../../apps/installer/src/installation/CanvasDatabasePreflight.js) |

Los archivos `.sql` constituyen el historial ejecutable de cambios del esquema: esta documentación no sustituye esas fuentes.

## 2. Variables de conexión

El plugin utiliza `DATABASE_URL` si existe; de lo contrario, `createDatabaseConfig()` construye los parámetros independientes siguientes.

| Variable | Función | Comportamiento observado |
|---|---|---|
| `DATABASE_URL` | Cadena de conexión PostgreSQL | Tiene prioridad frente a `DB_*` en `databaseConfig.js` |
| `DB_HOST` | Host del servidor PostgreSQL | Fallback del cliente: `localhost`; en Docker Compose la app utiliza `db` |
| `DB_PORT` | Puerto de conexión | `5432` de forma predeterminada |
| `DB_USER` | Usuario PostgreSQL | Fallback: `postgres` |
| `DB_PASSWORD` | Contraseña PostgreSQL | El código de conexión tiene un fallback local `postgres`; Compose utiliza un placeholder `CHANGE_ME_db_password_strong` si no se configura |
| `DB_NAME` | Nombre de la base de datos | Fallback del cliente: `feedback_db`; Compose utiliza `feedback_plugin_db` |

**Importante:** los defaults no son completamente uniformes entre el cliente y los archivos Compose. Una instalación debe utilizar valores explícitos y coherentes; no suponga que los fallbacks de ambos componentes apuntan a la misma base. Los placeholders **no son credenciales recomendadas** para despliegues reales.

El archivo `.env` se sitúa en la **raíz del repositorio** y no debe versionarse ni exponerse en capturas o logs públicos. En el flujo local, el instalador puede crear y completar configuración faltante. Consulte [Entorno de ejecución](../setup/ENVIRONMENT.md) para el alcance de `.env`, secretos y modos de arranque.

Ejemplo ilustrativo de nombres de variables, **sin contraseñas reales**:

```dotenv
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=feedback_plugin_db
DB_USER=postgres
DB_PASSWORD=<definir_un_secreto_local>
```

Si se ejecuta la aplicación dentro de la misma red de Docker Compose, normalmente se usa `DB_HOST=db` en lugar de `127.0.0.1`. No configure simultáneamente una `DATABASE_URL` contradictoria.

## 3. Organización del esquema

El esquema inicial está en [`001_initial_schema.sql`](../../packages/plugin-database/migrations/001_initial_schema.sql). Incluye entidades relacionadas con:

- **Plantillas e historial de feedback:** `plantilla_feedback`, `historial_feedback_generado`.
- **Configuración:** `configuracion_curso_tarea`, `configuracion_asignacion`, `variables_asignacion`, `configuracion_ia`.
- **Credenciales y auditoría:** `llaves_api_ia`, `logs_auditoria`.
- **Identidad y permisos:** `usuarios_local`, `user_lti_mappings`, `permisos_rol`, `canvas_user_tokens`.
- **Operación e integración:** notificaciones, webhooks y registros de migración.

**Los nombres finales, columnas, restricciones e índices deben verificarse aplicando todas las migraciones.** El directorio incluye, por ejemplo, `016_rename_tables_snake_case.sql`, que modifica nombres del esquema original, y migraciones posteriores que añaden campos o permiten feedback cualitativo sin plantilla. No deduzca el esquema actual a partir únicamente del archivo 001.

Las variables académicas del feedback, como `trayectoria_academica`, son distintas de las variables de entorno `DB_*`; su comportamiento se describe en [Variables globales y por curso](VARIABLES.md).

## 4. Migraciones y estado

El comando definido en [`package.json`](../../package.json) es:

```bash
npm run db:migrate
```

El ejecutor lee los SQL de `packages/plugin-database/migrations/`, comprueba las versiones guardadas en `schema_migrations`, aplica las pendientes dentro de transacciones y registra los resultados en `migration_logs`. Usa además un bloqueo consultivo PostgreSQL para coordinar la ejecución.

Dos archivos comparten el prefijo numérico `025_` (`025_add_configuracion_ia_fields.sql` y `025_allow_ungraded_feedback_without_template.sql`). El ejecutor guarda como versión el **nombre completo sin extensión**, por lo que no deben interpretarse como un único archivo. Mantenga ambos hasta revisar expresamente una estrategia de renumeración; esta reorganización documental no modifica migraciones ni historial aplicado.

Antes de migrar una base persistente, haga respaldo, verifique a qué instancia apunta la configuración y siga el procedimiento de [despliegue](../deployment/DEPLOYMENT.md). El preflight opcional de compatibilidad histórica no reemplaza un respaldo.

## 5. PostgreSQL en Docker y persistencia

[`docker-compose.db.yml`](../../docker-compose.db.yml) define el servicio `db` con imagen `postgres:15-alpine`, puerto del contenedor `5432`, healthcheck `pg_isready` y volumen nombrado `plugin_db_data` montado en `/var/lib/postgresql/data`. Define también el servicio Gotenberg, que **no es una base de datos**.

Puede observar el estado de los servicios del archivo Compose sin recrear ni eliminar datos:

```bash
docker compose -f docker-compose.db.yml ps
```

Si `db` ya está levantado y pertenece a ese proyecto Compose, puede consultar las tablas de la base configurada:

```bash
docker compose -f docker-compose.db.yml exec -T db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\dt"'
```

Estos comandos son de inspección. No use `docker compose down -v`, `docker volume prune` ni borrados de directorios para «limpiar» una instalación con datos que deban conservarse. El nombre efectivo de los volúmenes puede incorporar el nombre del proyecto Compose.

## 6. Verificación y diagnóstico

Para comprobar una instalación, diferencie estas preguntas:

1. **¿Existe PostgreSQL y responde?** Revise el healthcheck y `docker compose ... ps` del proyecto correcto.
2. **¿La aplicación apunta a esa base?** Contraste `DATABASE_URL` o los valores `DB_*` con la configuración del contenedor.
3. **¿El esquema está completo?** Inspeccione tablas y el contenido de `schema_migrations`; no confunda una conexión exitosa con una migración exitosa.
4. **¿Se conservan los datos tras reiniciar?** Compruebe el volumen asociado y haga respaldos antes de cualquier recreación.
5. **¿El problema es de Canvas y no del plugin?** El diagnóstico de Canvas local utiliza su propio esquema y herramientas, descritos en [Desarrollo local](../setup/LOCAL_DEVELOPMENT.md) y [Diagnóstico de Canvas](../testing/CANVAS_READONLY_DIAGNOSTICO_20261111.md).

Para problemas de instalación, permisos, puertos o contenedores consulte [Resolución de problemas](../setup/TROUBLESHOOTING.md).

## 7. Alcance y seguridad

Este documento describe el **código versionado en el repositorio**. No verifica ni altera los volúmenes, datos reales o credenciales existentes en un computador. La inicialización de `node_modules` con npm y la preparación de PostgreSQL/Docker son procesos diferentes; una instalación limpia de npm **no** reconstruye automáticamente una base antigua ni garantiza que un volumen Docker esté vacío.

Para decisiones de diseño, consulte [Arquitectura](ARCHITECTURE.md) y [Decisiones arquitectónicas](DECISIONS.md). Para controles de secretos, consulte [Seguridad](../security/SECURITY.md).
