# Paridad español/inglés — plantillas y cinco pruebas Gemini (2026-10-26)

## Alcance
- Ramas separadas: `english-version` y `main` con directorios de trabajo distintos; no se realizó merge entre ellas.
- Tres plantillas predeterminadas, normalización de saltos `\\n`, variables académicas opcionales, edición y previsualización, clonación inicial de plantillas, texto personalizado y guardas de cifrado.
- Los cambios anteriores ya estaban presentes y probados en ambas ramas antes de esta revisión. No se sobreescribieron traducciones españolas con inglés.
- Se trasladó la lectura opcional de `{{promedio_curso}}` en `FeedbackGenerationService`: únicamente si el adaptador ofrece un promedio de todo el curso; nunca se confunde con el promedio de una tarea.
- Las plantillas predeterminadas continúan sin `{{calificacion}}` ni `{{promedio_curso}}` activadas de fábrica.

## Resultados automatizados
- Español: ESLint sin errores; Vitest 317 correctas, 1 integración optativa omitida por la suite normal.
- Inglés: ESLint y 317 correctas; integración PostgreSQL optativa ejecutada y aprobada por separado en la revisión previa.
- La integración PostgreSQL española también fue ejecutada y aprobada por separado anteriormente.
- El conteo equivalente es 317/317 tests automatizados, más una integración opcional por rama.

## Pruebas Gemini sintéticas
- Script: `tools/diagnostics/five-template-gemini.mjs`; ejecutor `ejecutar-con-gemini.sh`.
- 1: Clase Estándar, 94/100, rango alto: PASS.
- 2: Feedback Detallado, 73/100, rango medio: falló inicialmente por HTTP 503 externo, luego PASS en repetición aislada.
- 3: Evaluación Cruzada, 42/100, rango bajo: PASS.
- 4: Clase Estándar con `{{calificacion}}` y `{{promedio_curso}}`, 88/100 y promedio sintético 74/100: PASS.
- 5: entrega con ambas variables ausentes: omisión de variables comprobada por separado y generación cualitativa desde el entregable: PASS.
- Los cinco escenarios generaron respuestas en español. Las peticiones son reales; estudiantes, calificaciones, entregas y almacenamiento de feedback son sintéticos/en memoria. No hubo publicación en Canvas.
- El generador de pruebas español toma las plantillas existentes de PostgreSQL, si las encuentra, o sus semillas localizadas en `TemplateRepository.js`, normalizándolas para respetar saltos de línea reales. No mezcla contenido inglés de las semillas.
- Los informes completos se guardan localmente en `logs/gemini-cinco-pruebas-espanol-*.md` y JSON; no se incluyen en Git.

## Advertencia de configuración local (pendiente)
En esta computadora, el `.env` de la instalación española NO pudo descifrar el registro Gemini existente de PostgreSQL. La verificación de generación en español tuvo éxito ejecutándose de modo efímero con la configuración local de la instalación inglesa, sin editar ningún `.env` ni mostrar claves. Esto **valida el código y las plantillas españolas, pero no demuestra que Gemini funcione con el entorno español independiente**. Una solución definitiva exige verificar cómo se comparten bases y claves de cifrado, antes de cambiar credenciales o conservar registros incompatibles.

## Historial y criterios de aceptación
Con nota se selecciona rango y plantilla, sin analizar el entregable; sin nota se analiza el entregable en la ruta cualitativa, sin aplicar la plantilla docente. Esta distinción es intencional.
La variable `{{promedio_curso}}` solo se completa cuando hay dato general válido.
Si un test real recibe HTTP 503, se documenta el intento y se repite solamente el caso fallido.
