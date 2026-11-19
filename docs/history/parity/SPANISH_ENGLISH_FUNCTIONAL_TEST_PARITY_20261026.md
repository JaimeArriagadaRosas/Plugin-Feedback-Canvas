# Paridad funcional y de pruebas inglés–español (26-10-2026)

## Criterio obligatorio
Ambos worktrees representan la misma aplicación: se permite exclusivamente localización de textos, plantillas, nombres de vistas y mensajes. No se consideran aceptables diferencias en respuestas estructuradas, códigos, autorización, datos ni controles de seguridad. Los conteos de tests son un control mínimo; no son por sí solos una prueba formal de equivalencia de todas las ramas.

## Auditoría
Se compararon archivos y casos de prueba de las dos ramas, no solo sus conteos. Inglés tenía tests ausentes de postflight, descarga/redirecciones, seguridad, configuración de rutas, middleware OAuth y parsing de análisis CSV; español ya tenía pruebas de neutralidad para las plantillas locales. Además, un test de timestamp de cuestionarios estaba en inglés y faltaba en español.

## Correcciones funcionales
- El controlador español de descargas ahora sigue hasta cinco redirecciones 301, 302, 303, 307 y 308, conserva el parámetro firmado `sf_verifier` en saltos y elimina cabeceras de autorización y host al cambiar de origen; los mensajes se mantienen en español.
- CSV de Canvas: los encabezados duplicados se indexan y no bloquean la extracción de respuestas correctas, sin atribuir datos al alumno equivocado.
- OAuth: los errores de credencial ausente marcados con `data.requireOAuth` o `metadata.requireOAuth` reciben la misma respuesta estructurada 401, con texto español.
- Seeds locales Canvas: registros de intentos de quiz ahora incluyen `started_at`, `finished_at` y `quiz_data` coherentes con el flujo inglés.
- Se incorporó el gestor de rutas `ApiRouteManager.js` que faltaba en el árbol español y sus pruebas, junto a controles de seguridad, postflight y middleware; ninguna ruta existente fue eliminada deliberadamente.
- Plantillas: se ampliaron los valores límite para evaluación en puntos, incluidos 59.9/100 y 8.6/10, más el rechazo de un máximo inválido. Las variables permanecen en español.

## Resultados
- Servidor + instalador inglés: 301 aprobadas, 1 omitida, 0 fallidas, 75 archivos (última ejecución previa de esta sesión).
- Servidor + instalador español: **301 aprobadas, 1 omitida, 0 fallidas, 75 archivos**, ejecutadas de nuevo con `CI=true` y clave ficticia `ENCRYPTION_KEY` de 64 caracteres.
- ESLint español: 0 errores.
- Build de cliente español: Vite completo; warning no bloqueante por tamaño de chunks.
- Dos pruebas del cliente español habían aprobado por separado antes de este conjunto de cambios; repetir test:client/ejecuciones E2E para validación integral.

## Verificaciones adicionales aún necesarias
- Comparación profunda de todos los módulos y rutas que aún presentan diferencias históricas no relacionadas con traducción; lograr 301/301 no demuestra por sí solo equivalencia total.
- Prueba de arranque, apagado y feedback real español en su entorno dedicado, seguida de la misma prueba inglesa sin modificar bases ni recursos compartidos.
- Confirmación de GitHub Actions tras publicar este commit y prueba de distribución npm limpia con versiones soportadas.
- Resolver por separado los problemas de concurrencia distribuida de refresh y revocación OAuth conocidos en ambas ramas.
