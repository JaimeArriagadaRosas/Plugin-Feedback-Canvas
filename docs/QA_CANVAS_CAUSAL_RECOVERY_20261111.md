# QA causal, recuperación segura y consola — Canvas LMS

Fecha de investigación: 10–11 de noviembre de 2026. Proyecto: Plugin Feedback Canvas.
Ámbito: clon `/home/jaime/proyectos/Plugin-Feedback-Canvas-repro-fk-20261110`; laboratorio aislado `/home/jaime/qa-feedback-20261110`. No se alteró el entorno histórico ni se hizo push.

## Problema observado

Durante `Login::CanvasController#create`, Canvas informó `ActiveRecord::InvalidForeignKey` / `PG::ForeignKeyViolation` al insertar `terms_of_services.account_id=100000000000001`. La restricción `fk_rails_337ba633a9` refiere `accounts.id`.

**Hecho importante:** el mecanismo real de Canvas `TermsOfService.ensure_terms_for_account` puede intentar crear términos para una cuenta raíz. Los términos se comprueban desde el modelo `Account` y el helper de login. La presencia del ID de apariencia global y la imposibilidad de resolverlo en el laboratorio merecen investigar shards; NO demuestran por sí solas que exista un bug de shards ni que instalaciones antiguas sean culpables.

## Experimentos reales en PostgreSQL aislado

`QA_ALLOW_FAULT_INJECTION=true ... python3 tools/diagnostics/qa_canvas_fk_matrix.py`

La herramienta exige contenedor con etiquetas `com.docker.compose.project=qa-...` y `com.docker.compose.service=postgres`; si no coinciden, se detiene. Ejecuta `BEGIN` y termina sin `COMMIT`; usa un identificador negativo explícito para no modificar secuencias. Compara huellas antes/después de las tablas `accounts` y `terms_of_services`.

| Caso | Resultado observado | Relevancia |
| --- | --- | --- |
| Términos con ID global inexistente | FK `fk_rails_337ba633a9` | Reproduce la restricción, pero no el origen de la referencia |
| Términos con cuenta local inexistente | Misma FK | La FK no exige necesariamente un problema de shard |
| Cuenta existente con términos duplicados | Error de índice único | Es una falla distinta |
| Cuenta secundaria existente | Inserción SQL válida; rollback | FK por sí sola no comprueba la regla de cuenta raíz de Rails |
| `search_path` incorrecto | Tabla no encontrada | Es una falla distinta |
| Conexión a otra base sin esquema Canvas | Tabla no encontrada | Es una falla distinta |

Resultado: **6/6 verificaciones**. Huella de datos antes/después: **idéntica**. Estas son pruebas transaccionales de PostgreSQL, no seis reproducciones espontáneas del HTTP 500 de Canvas.

## Regresión real sin interfaz gráfica

La suite versionada `tools/diagnostics/qa_headless_suite.sh` requiere Canvas local en ejecución y usuarios **sintéticos** configurados por variables de entorno: `QA_ADMIN_USER`, `QA_PROFESSOR_USER`, `QA_STUDENT_USER`, `QA_LOGIN_PASSWORD`. Opcional: `QA_CANVAS_URL`, `QA_SCREENSHOT_DIR`, `QA_CHECK_LTI`.

No se versionan credenciales; no se usan cookies/credenciales reales. La suite prueba logins, múltiples pestañas, sesiones eliminadas/adulteradas, nuevo login y acceso LTI en Chromium headless. Los resultados se escriben en `logs/qa-headless/` (ignorados por Git) o en `QA_SCREENSHOT_DIR`.

El 11/11: **11/11 recorridos aprobados** (4 pruebas de administrador, 4 de profesor, 1 login de estudiante, 2 LTI), sin FK espontáneo. Pruebas de la sesión anterior: 10/10 logins adicionales y 3/3 reinicios de contenedores. Los 12 segundos de inactividad son solo un control breve, no una expiración de horas.

## Diagnóstico y mensajes

En errores HTTP 5xx de `POST /login/canvas`, el proxy **observa** la respuesta sin cambiar HTML, códigos ni contenido:
- `CANVAS-DB-003`: la FK de términos; explica hipótesis, recuperación bloqueada y chequeos aconsejados.
- `CANVAS-LOGIN-500`: error interno no clasificado; no confunde otras fallas con FK.
- Informe JSON sin capturar HTML, contraseñas, ID de cuenta ni cookies en `logs/canvas-incidents/`, con permisos restringidos si el sistema los admite.
- Falla de escritura: no modifica la respuesta original; se avisa por consola.

Los códigos son descripciones de síntomas, no una declaración de la causa exacta del profesor.

## Recuperación acotada

`SharedDependencyRecovery.recoverOwnedStopped` opera **solo con opt-in** `PLUGIN_ALLOW_OWNED_SERVICE_RECOVERY=true` y `COMPOSE_PROJECT_NAME` explícito. Valida proyecto, etiqueta de servicio, imagen, puertos, credenciales esperadas y volumen de la base del plugin. Puede ejecutar una sola vez `docker start` sobre un servicio *detenido* y propio, y espera un estado saludable con plazo limitado. **Nunca** elimina o recrea contenedores o volúmenes, nunca reinicia un servicio activo no saludable, nunca toca la base interna de Canvas. Si el estado cambió, falta identificación o no se recupera, bloquea y explica el motivo.

La automatización se integra en la etapa de dependencias del instalador solo cuando está habilitada explícitamente. Sin habilitación, el comportamiento conservador anterior permanece.

## Pendientes y límites

1. No se ha obtenido una secuencia natural reproducible de la excepción original durante el login. La inyección histórica controlada de Rails era una prueba del observador, no de la causalidad.
2. No hay datos de la configuración efectiva del profesor; **no corresponde asignar porcentajes estadísticos de causa**. Las instalaciones antiguas y una referencia de shard siguen abiertas como hipótesis.
3. El laboratorio tiene un único shard: no permite validar un escenario multi-shard real.
4. Para aislar al causante se necesitará un paquete diagnóstico de solo lectura en el entorno afectado: versión, base efectiva, nombre de proyecto Compose, trazas de Rails anteriores al error y relación entre ID global y cuenta local. No solicitar contraseñas, claves privadas ni copiar volúmenes de producción sin consentimiento específico.
5. No realizar autoreparaciones de `accounts`, `terms_of_services`, FKs, `shards` ni autenticación de Canvas hasta demostrar su mecanismo exacto y un método oficial seguro.

Todas las pruebas con cambios en el estado de servicios se realizaron exclusivamente contra los contenedores aislados del laboratorio, nunca contra el clon histórico.


## Validaciones reales finales (11/11)

- Recuperación comprobada: detuvimos Gotenberg exclusivamente en QA; recuperador identificó Compose owner y devolvió reuse tras docker start y verificación healthy. Evidencia: qa-feedback-20261110/logs/qa-real-safe-recovery-result.log.
- Reproducción controlada de HTTP 500 del login: el proxy imprimió CANVAS-DB-003 y guardó un JSON con permisos 0600 sin contraseñas, cookies ni identificador problemático. Evidencia: qa-feedback-20261110/logs/qa-forced-fk-reporter-run.log.
- El controlador Rails del laboratorio fue restaurado al hash previo; QA_PATCH_INACTIVE. Login administrativo posterior: HTTP 302 sin violación FK.
- Un primer npm test sin ENCRYPTION_KEY falló en un fixture AES-GCM preexistente; al ejecutar con clave sintética de prueba se aprobó la regresión completa. No se guardó esa clave en Git.

Estas pruebas no demuestran la causa espontánea del error original del profesor.
