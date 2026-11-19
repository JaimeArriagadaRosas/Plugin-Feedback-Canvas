# Revisión de cobertura español/inglés e identidad Git — 26 octubre 2026

## Historial y preservación
- Repositorio publicado: `JaimeArriagadaRosas/Plugin-Feedback-Canvas`.
- Se creó y verificó el bundle completo anterior a la reescritura: `/home/jaime/proyectos/git-safety-backups/feedback-20261026/before-author-rewrite.bundle` (fuera del repositorio).
- Se reconstruyó el historial alcanzable de `main`, `english-version` y `feat/spanish-parity-oct26` reemplazando únicamente metadatos de autor y committer erróneos por `Jaime Andrés Arriagada Rosas <163452202+JaimeArriagadaRosas@users.noreply.github.com>`.
- Se comprobaron árboles Git idénticos para cada rama antes de publicar, y cero identidades incorrectas en los historiales reconstruidos. Se hizo push con lease que exigía los SHA remotos conocidos; sin borrar ramas. El proceso de reescritura cambia SHA de commits, enlaces históricos y referencias antiguas, que pueden seguir presentes en copias locales, cachés o GitHub hasta limpieza posterior.
- Se configuró la identidad correcta de Git para nuevos commits en el repositorio local compartido.

## Diferencia de cobertura
- Inglés: 301 pruebas de servidor/instalador aprobadas, 1 omitida.
- Español antes del traslado: 270 aprobadas, 1 omitida.
- Español después del traslado compatible: **279 aprobadas, 1 omitida, ninguna fallida**, más 2 casos de cliente ejecutados y aprobados por separado.
- La diferencia numérica no equivale automáticamente a 22 escenarios pendientes: hay implementaciones y suites exclusivas de cada idioma.
- Nuevos archivos españoles validados: `apps/installer/tests/unit/shared-dependency-recovery.test.js` (9 pruebas) y `apps/client/tests/unit/api-client.test.js` (2 pruebas de cliente).

## Pruebas inglesas que requieren adaptación antes de portarse
Se intentó trasladar siete archivos de pruebas inglesas a español. El primer ensayo dio 288 aprobadas, 8 fallidas, 1 omitida y 1 archivo que falló durante su carga. Tras el diagnóstico, únicamente se conservaron los dos archivos compatibles citados arriba. El registro del ensayo está preservado fuera de Git en `/home/jaime/proyectos/git-safety-backups/feedback-20261026/parity-test.log`.

- `shared-postflight-startup.test.js`: dos casos de error de postflight presentan contratos diferentes; contrastar el bloqueo y la recuperación sin modificar los contenedores reales.
- `security.test.js`: cuatro casos relacionados con redirecciones, límite de saltos y conservación de la firma en consultas no cumplen con la implementación española; investigar seguridad y semántica de la descarga antes de integrar.
- `api-route-manager.test.js`: falla la carga; estudiar dependencias y diferencias del constructor de rutas.
- `canvas-oauth-middleware.test.js`: el caso sin token en español comunica error mediante `next(error)` y no necesariamente respuesta directa; el test inglés asume respuesta inmediata. Adaptar aserciones a contrato y verificar que el middleware de errores produzca 401 y `requireOAuth`.
- `quiz-student-analysis-csv.test.js`: caso de encabezados CSV duplicados provoca excepción del parser; evaluar si corresponde normalizar encabezados antes de extraer respuesta, con regresión segura.
- `canvas-neutral-templates.test.js`: test del idioma inglés no se trasladó sin cambios; en español ya existe `neutral-spanish-parity.test.js`, con 10 escenarios válidos.

No se afirma que las diferencias anteriores estén resueltas. No se alteró código funcional para hacer pasar pruebas ajenas a sus contratos.

## Corrección CI
- El workflow `security.yml` proporciona una clave **ficticia no productiva** de 64 caracteres hexadecimales, **entre comillas YAML** y limitada al job `test`.
- Se mantiene la exigencia original de `ENCRYPTION_KEY` para producción.
- La suite española se reejecutó con `CI=true` y esta clave: 279 aprobadas, 1 omitida y 0 fallidas. ESLint: 0 errores.
- La confirmación del workflow ejecutado en GitHub Actions debe evaluarse por separado; pruebas locales no prueban automáticamente un workflow remoto verde.

## Pendientes
1. Revisión de los fallos de seguridad, redirect y parsing CSV sin debilitar controles existentes.
2. Adaptar la cobertura OAuth y postflight donde el contrato español sea intencionalmente diferente.
3. Validar generación real de feedback y arranque/cierre español después del último commit.
4. Mantener como deuda técnica explícita la coordinación distribuida de refresh tokens y la revocación transaccional.
5. Revisar otras ramas locales históricas y clones externos antes de reutilizarlos tras el cambio de SHA. La publicación en GitHub no garantiza borrado inmediato de referencias o cachés antiguas fuera de las tres ramas actualizadas.
