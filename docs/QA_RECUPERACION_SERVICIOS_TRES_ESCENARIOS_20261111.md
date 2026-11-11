# Recuperación segura de servicios Docker — tres escenarios

**Fecha de validación:** 11 de noviembre de 2026
**Repositorio de implementación:** `~/proyectos/Plugin-Feedback-Canvas-feedback-cualitativo`, `main` en español.
**Alcance:** opción 3 («Ejecutar localmente Canvas LMS») y servicios compartidos PostgreSQL/Gotenberg. **No se ha modificado el menú interactivo.**

## Incidente reproducido

La instalación de origen tenía `.setup_complete`, los assets y la configuración Fast Boot presentes, pero estos contenedores Docker existían y estaban detenidos:

- `feedback_plugin_db_local` — PostgreSQL 15
- `feedback_plugin_gotenberg_local` — Gotenberg 8

Sin las variables especiales `COMPOSE_PROJECT_NAME` y `PLUGIN_ALLOW_OWNED_SERVICE_RECOVERY=true`, el comportamiento anterior bloqueaba la opción 3 mediante «Partial, unhealthy or stopped shared services require manual diagnosis». **No había pruebas de corrupción de PostgreSQL ni necesidad de ejecutar la primera instalación nuevamente.**

### Comportamiento nuevo

El instalador conserva el arranque habitual cuando los servicios están saludables. Cuando detecta servicios existentes detenidos, ahora:

1. Comprueba que los contenedores corresponden al proyecto Docker Compose efectivo, usando `docker compose -f docker-compose.db.yml config --format json`.
2. Verifica proyecto, servicio, imagen, nombre de contenedor, directorio de trabajo, archivo Compose original, credenciales PostgreSQL, puertos y **nombre del volumen persistente esperado**.
3. Si todo corresponde a este clon y hay servicios propios detenidos, ofrece la confirmación `[s/N]` (respuesta predeterminada negativa).
4. Tras una respuesta afirmativa, **vuelve a comprobar identidad y estado**, inicia solamente los contenedores propios detenidos mediante `docker start`, espera hasta 40 segundos por sus healthchecks y valida que ambos están saludables.
5. Continúa el flujo normal y las migraciones oficiales existentes; **no recrea, elimina, renombra ni reemplaza volúmenes**.

El modo `NON_INTERACTIVE=true` no puede responder afirmativamente por sí solo: requiere la configuración explícita anterior para recuperación desatendida. Un proyecto desconocido, servicio activo pero defectuoso, credenciales incompatibles, archivo de origen diferente, puerto distinto o volumen ajeno provocan bloqueo seguro. Si se inicia un contenedor y otro falla, el diagnóstico declara qué servicios sí fueron iniciados, sin afirmar falsamente que todo permaneció detenido.

## Tres escenarios principales

| Caso | Estado inicial | Acción verificada | Resultado real |
|---|---|---|---|
| 1. Flujo normal | PostgreSQL y Gotenberg saludables | Reutilización sin confirmación ni recreación | **PASS** |
| 2. Recuperación convencional | PostgreSQL detenido; Gotenberg saludable | Autorización, arranque y healthcheck del servicio detenido | **PASS** |
| 3. Error original | Ambos contenedores detenidos y sin las dos variables especiales | Se reproduce bloqueo, se comprueba rechazo sin cambios y luego autorización con doble recuperación | **PASS** |

Para comprobar que la base conserva información entre la detención y el reinicio, el laboratorio creó un registro centinela en su **base PostgreSQL desechable** y lo consultó después de cada recuperación.

Cuatro controles negativos también finalizaron correctamente: dueño Compose ajeno, credenciales incompatibles, puerto publicado incorrecto y ejecución no interactiva sin permiso. No se hicieron pruebas destructivas sobre contenedores históricos.

**Resultado E2E Docker: 7/7 aprobadas, 0 fallos, limpieza de todos los recursos temporales confirmada.**

### Cobertura unitaria

La lógica del módulo y su integración con `EnvironmentSetup` tienen pruebas para los tres escenarios, negativa del usuario, cambio de estado durante la confirmación, volumen errado, imagen incorrecta, puertos distintos, servicios no saludables, proyecto ajeno, ruta Compose distinta y modo desatendido. La ruta anterior de recuperación mediante autorización explícita se conserva.

## Cómo repetir la validación

Requiere Docker operativo y utiliza exclusivamente el proyecto aleatorio `qa-compat-*`:

```bash
cd ~/proyectos/Plugin-Feedback-Canvas-feedback-cualitativo
QA_ALLOW_DISPOSABLE_COMPAT_TESTS=true \
PLUGIN_TEST_MODE=true PLUGIN_QA_NO_BROWSER=true \
python3 tools/qa/qa_three_recovery_scenarios.py \
  ~/qa-feedback-20261110/artifacts/qa-three-service-recovery-20261111.json
```

La ejecución crea y elimina su propio Compose, redes y volúmenes; publica PostgreSQL y Gotenberg solo en puertos aleatorios de `127.0.0.1`. Los tests JS correspondientes están en:

- `apps/installer/tests/unit/interactive-shared-service-recovery.test.js`
- `apps/installer/tests/unit/environment-setup-recovery-consent.test.js`

## Confirmación de la instalación real (solo lectura)

Se llamó a `SharedDependencyRecovery.previewStoppedRecovery()` con el `.env` de la instalación real. El resultado fue `recoverable`, **propietario Compose correcto y dos servicios propios detenidos**.

**No se arrancó ninguno de ellos durante esta etapa**. Ambos siguen detenidos. El usuario puede ejecutar `npm start`, seleccionar opción 3 y autorizar la recuperación cuando se muestre el mensaje; no necesita modificar permanentemente su `.env`.

El E2E de Docker verifica PostgreSQL/Gotenberg, pero **no garantiza por sí mismo que el Canvas, LTI y la interfaz final funcionen**, porque esos son servicios y validaciones adicionales. El siguiente arranque normal debe confirmar la continuación efectiva hasta Canvas; nunca debe considerarse aprobado por anticipado.

## Restricciones mantenidas

No se tocó el menú, ni los clones antiguos, ni los volúmenes históricos. La implementación se realizó únicamente en este clon unificado. Los recursos QA se eliminaron después de ejecutar las pruebas. No se ha realizado push a GitHub.
