# Paridad española — 26 de octubre de 2026

## Alcance y origen
Rama de trabajo: `feat/spanish-parity-oct26`, creada desde `main` commit `0290c3c`. La rama inglesa `english-version` fue publicada en GitHub con commit `fea30fd` antes de comenzar esta paridad. Evitar merges masivos: ambas ramas tienen desarrollos funcionales propios.

## Cambios trasladados
- Menú: `[0] Salir`, entradas válidas, cancelación con Ctrl+C sin ejecutar opción 3 y confirmaciones cancelables.
- Inicio y cierre: controlador de apagado registrado antes del setup de Canvas, TLS proxy con cierre esperado, SIGINT/SIGTERM/SIGKILL acotados, control de Vite y cierre de refresh de tokens antes de PostgreSQL.
- Tokens: intervalo inicial cancelable, barridos sin solapamiento, cifrado ilegible con aviso controlado, 429/5xx y timeout como errores transitorios 503 conservando credenciales. El logout del navegador no equivale a revocar OAuth.
- Docker: recuperar solo ante conflictos detectados, identificar contenedores compartidos, evitar recrear nombres ocupados, verificar dependencias compartidas en postflight y proteger el backend de un segundo `docker compose up`.
- Plantillas: las tres semillas globales españolas ya estaban libres de calificación/promedio; se eliminó `{{promedio_curso}}` de la plantilla nueva y la vista previa dejó de mostrar las notas ficticias 3.5/5.2.
- Evaluación: rangos alto/medio/bajo según puntos de Canvas y umbrales 86%/60%, sin nota chilena dentro del flujo revisado. `{{calificacion}}` y `{{promedio_curso}}` siguen disponibles para inserción voluntaria; las frases se omiten cuando no hay datos. No se convierte el promedio de una actividad en promedio general del curso.

## Pruebas
- Suite de servidor e instalador en worktree de paridad: **270 aprobadas, 1 omitida, 0 fallidas**, con clave de cifrado ficticia para tests. El worktree no tenía dependencias ni .env propios; se usaron enlaces locales de node_modules (no deben versionarse).
- Tests de neutralidad española: 10/10 aprobados; selección de rangos, puntajes nativos, plantillas por defecto, omisión de variables opcionales.
- Tests de shutdown/refresco traducidos: pasan con mensajes españoles.
- ESLint global detectó **5 errores preexistentes** fuera del código de paridad: 2 advertencias de detección de acceso dinámico a CSV en QuizAnswerFacade.js y 3 patrones de XML en DocumentToMarkdownConverter.js. El error adicional de límite de longitud surgido en FeedbackGenerationService fue gestionado localmente sin alterar el flujo. Resolver los cinco de forma independiente con pruebas de seguridad para no introducir regresiones.
- No se ejecutó arranque integral español de Canvas en este worktree porque no tenía .env/certificados/instalación propios. Antes de publicar en `main`, probar opción 3, dos shutdown y un E2E de generación real con un entorno español validado.

## Datos y seguridad
No se borraron plantillas existentes ni registros OAuth; tampoco se cambiaron ENCRYPTION_KEY ni volúmenes. La base local de desarrollo es compartida con la inglesa y contiene personalizaciones: **no regenerar plantillas sin clasificación exacta y respaldo**. Las tres semillas españolas por código son neutrales, pero los registros personalizados existentes permanecen como los haya definido el profesor.

## Riesgos pendientes
1. OAuth multiinstancia: los tests demuestran renovación doble y resurrección tras desconexión. Requiere bloqueo distribuido por identidad, generación/versión y UPDATE condicional; no se considera resuelto.
2. Ctrl+C durante setup temprano: se registró controlador antes del setup, pero operaciones de Docker y runner aún no propagan AbortSignal; se necesita una prueba real de interrupción temprana para declararlo cerrado.
3. Promedio general: solo debe poblarse con una estadística oficial inequívoca de Canvas; si no está disponible, se omite.
4. Realizar una revisión de TLS y terminal Windows/WSL con instalación española antes del merge final.
5. Revisar si es necesario un flujo separado y autenticado `Desconectar Canvas`, sin revocar automáticamente el token al cerrar la sesión web.

## Publicación
La rama española de paridad permite un PR/revisión incremental. Evitar escribir directamente en `main` hasta superar el bootstrap español real, ESLint y el E2E de generación y cierre. Esta es una decisión de control de calidad, no una afirmación de que los cambios estén completamente verificados en producción.

## Validación posterior: arranques completos y semillas multilenguaje
Se ejecutó `tools/diagnostics/verify-start-stop-pipe.py` usando configuración/certificados propios locales copiados de la instalación española (ignorados por Git). El marcador de confianza para la CA mkcert se reutilizó solo tras verificar que su SHA-256 coincidía con `rootCA.pem`, sin importar certificados nuevos ni modificar el almacén de Windows.
**Dos ciclos reales de arranque completo español + SIGINT**: 34,3 s cada uno, código de salida 0, puertos 3000/5173/8443 libres después de cada ciclo; seis contenedores Docker originales preservados. Se corrigió el wrapper `Orchestrator.stopTlsProxy` para esperar realmente el cierre del proxy HTTPS.
La revisión de PostgreSQL encontró inicialmente cero semillas globales con los tres nombres españoles y varias semillas inglesas. El repositorio español solo sembraba cuando **no existía ningún registro global de ningún idioma** y el metadato `has_seeded_templates` era compartido. Ambos supuestos eran incorrectos. Se implementó detección por nombres de idioma y clonación selectiva idempotente; el bloqueo advisory evita carreras entre instalaciones; las plantillas borradas deliberadamente no se recrean.
`tools/diagnostics/verify-spanish-template-bootstrap.mjs` probó sobre PostgreSQL con tablas temporales: una semilla inglesa preexistente, tres semillas globales españolas, tres copias de profesor, segunda ejecución sin duplicados y eliminación suave respetada. Resultado PASS; no se modificaron plantillas reales.
Los patrones XML problemáticos se reemplazaron por extracción lineal de etiquetas y el acceso dinámico al informe de CSV por `Object.entries`; así ESLint global terminó sin errores y la suite previa seguía verde. Estas correcciones deben figurar en la revisión de seguridad y tests de archivos de la versión española.
