# Matriz de compatibilidad y recuperación de Canvas

La ejecución QA se realiza solamente cuando se solicita. No se instalan tareas
permanentes ni se modifican instalaciones históricas o contenedores no propios.

## Política
- Todo escenario debe demostrar el fallo, la acción esperada y el resultado final.
- Los escenarios recuperables requieren identidad Docker verificada y autorización explícita.
- Los estados incompatibles de bases históricas se bloquean. Detectarlos no constituye
  una migración ni garantiza que una instalación antigua sea compatible.
- No abrir ventanas: usar simultáneamente PLUGIN_TEST_MODE=true y
  PLUGIN_QA_NO_BROWSER=true.
- Si solo se define una bandera, el comportamiento normal de npm start continúa intacto.
- Playwright utiliza Chromium headless.
- Los recursos y bases de pruebas son de un proyecto QA independiente y se eliminan al finalizar.

## Estados
- PASS: comportamiento previsto y ausencia de efectos inesperados.
- BLOCKED: problema no recuperable correctamente notificado, sin cambios.
- SKIPPED: escenario no ejecutable por falta de un prerrequisito real.
- FAIL: comportamiento incorrecto.

Un bloqueo correcto puede constituir un test PASS si el escenario esperaba ese bloqueo.

## Ejecución y evidencia comprobada (11 de noviembre de 2026)

Se ampliaron las pruebas en la rama española main del clon unificado.

### Pruebas reales con Docker desechable

Archivo: tools/qa/disposable_services.py
Compose: tools/qa/docker-compose.compat.yml

El ejecutor reserva un proyecto Compose aleatorio qa-compat-XXXXXXXX, utiliza
puertos de localhost específicos, verifica propiedad de cada contenedor antes de
detenerlo y elimina su volumen al terminar. No opera sobre los servicios
persistentes de Canvas ni los del profesor.

Casos reproducidos y validados (14/14): inicio limpio; PostgreSQL, Gotenberg y
ambos detenidos; denegación sin autorización; propietario, puerto, credenciales
o contenedor incorrectos; Redis detenido notificado sin recuperación insegura;
migraciones iniciales antiguas del plugin, actualización del plugin conservando
datos, idempotencia y bloqueo ante una migración desconocida.

Ejemplo en el laboratorio QA existente:

    QA_ALLOW_DISPOSABLE_COMPAT_TESTS=true PLUGIN_TEST_MODE=true \
    PLUGIN_QA_NO_BROWSER=true python3 tools/qa/disposable_services.py \
    /home/jaime/qa-feedback-20261110/artifacts/qa-compat-disposable.json

**No hay compatibilidad universal de bases antiguas.** La migración probada
corresponde a las tablas propias de Plugin Feedback, no al esquema interno de
Canvas LMS. Un historial discontinuo, desconocido o sin versiones pero con
tablas de aplicación presentes provoca bloqueo seguro mediante
PLUGIN_SAFE_MIGRATION_PREFLIGHT=true. El proceso normal de migraciones no cambia
de manera predeterminada; la protección adicional se activa expresamente.

### Autenticación real sin ventanas y LTI

Archivo: tools/qa/authentication_e2e.py

Usa únicamente cuentas sintéticas del laboratorio Canvas local y Chromium
headless. Inyectar errores artificiales de FK está deshabilitado en este
controlador. Las contraseñas de las cuentas de prueba se leen del .env de la
copia QA y no se incluyen en los informes.

Se comprobaron 11/11 recorridos: administrador y profesor con recargas, pestañas
paralelas, cookies eliminadas y cookies alteradas; estudiante con login; LTI con
iframe para administrador y profesor. La segunda ejecución utilizó la opción 3
del instalador en modo QA y verificó el mensaje QA-NO-BROWSER-001 sin iniciar
el navegador predeterminado.

    QA_ALLOW_CANVAS_AUTH_TESTS=true PLUGIN_TEST_MODE=true \
    PLUGIN_QA_NO_BROWSER=true python3 tools/qa/authentication_e2e.py \
    --report /home/jaime/qa-feedback-20261110/artifacts/qa-auth.json --include-lti

Solo se ejecuta contra el laboratorio identificado por sus etiquetas Docker,
ruta exacta de trabajo y puerto de Canvas. Si el proxy HTTPS QA no está
disponible, las pruebas LTI se marcan SKIPPED: no se inventa un resultado.

### Informes y no falsos positivos

tools/qa/check_coverage.py consolida los 14 escenarios Docker y los 11 de
autenticación/LTI. No acepta pruebas omitidas, casos duplicados, limpieza sin
confirmar o casos faltantes como resultados satisfactorios.

Resultado del laboratorio: 25/25 E2E aprobados y limpieza confirmada.
Informes inspeccionables fuera de Git:

- /home/jaime/qa-feedback-20261110/artifacts/qa-compat-disposable-v3-20261111.json
- /home/jaime/qa-feedback-20261110/artifacts/qa-auth-compatibility-with-lti-20261111.json
- /home/jaime/qa-feedback-20261110/artifacts/qa-compat-coverage-20261111.json

El clon temporal del plugin usado para la prueba LTI fue restaurado a sus
archivos originales y el servidor QA se cerró ordenadamente mediante SIGINT.

### Regresión adicional

Las pruebas unitarias verifican el modo sin ventanas, la recuperación de Fast
Boot interrumpido, las restricciones de SQL en modo lectura, los fallos de Redis,
el historial de migraciones del plugin y los guardas de identidad.

### Casos pendientes — no declarar compatibilidad

Los siguientes siguen sin una reproducción E2E real:

1. Actualizar una versión histórica completa de Canvas LMS y sus datos
   usando las migraciones oficiales pertinentes.
2. Autenticación con múltiples shards reales, no identificadores sintéticos.
3. Reproducir espontáneamente el error exacto del profesor sin inyección.
4. Resolver un puerto ocupado por un proceso ajeno en un E2E independiente
   (la detección de desajuste de puerto sí está probada).
5. Reanudar una instalación íntegra de Canvas interrumpida mediante E2E
   (la recuperación del marcador Fast Boot tiene pruebas unitarias).

Se prioriza no alterar la instalación habitual. Las reparaciones de cuentas,
términos y shards permanecen deliberadamente deshabilitadas hasta contar con
evidencia de una recuperación segura y reversible.

## Ampliación de las cinco situaciones restantes (11/11/2026)

Se incorporó un ensayo E2E auténtico de puertos ajenos, dos pruebas de
integración de reanudación de instalación, una comparación de historiales de
migración de Canvas (solo lectura), y un verificador de requisitos multi-shard.
La opción 6 también informa migraciones pendientes o desconocidas.

**Cobertura total verificada: 26/26 E2E**, con cuatro cuestiones abiertas
que se identifican separadamente, sin presentarlas como éxito.

Detalles, comandos y limitaciones:
[Escenarios restantes de Canvas](QA_CANVAS_REMAINING_SCENARIOS_20261111.md).

## Pruebas con versiones y volúmenes históricos reales (11/11/2026)

Se implementó un laboratorio desde la línea de comandos, sin nuevas opciones de
menú. Cuatro variantes del código histórico compilaron sobre copias temporales;
dos bases PostgreSQL 14 históricas superaron las consultas de integridad y una
tercera se bloqueó por carecer del esquema principal de Canvas.

**Resultados:** 10 comprobaciones positivas, 1 bloqueo seguro, 0 cambios en
las fuentes históricas. Esto no demuestra aún login LTI cruzando versiones ni
un upgrade entre versiones distintas de Canvas.

Documentación: [Laboratorio histórico real](QA_CANVAS_HISTORICAL_REAL_20261111.md).
