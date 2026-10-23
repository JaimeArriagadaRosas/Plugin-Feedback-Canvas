# Pendiente obligatorio: replicar mejoras de main en la versión inglesa

**Estado:** registrado, sin ejecutar.
**Fecha:** 2026-10-23.
**Rama de origen funcional:** `main` (español).
**Rama de destino prevista:** `english-version`.
**Dependencia:** terminar, probar y fusionar en `main` el plan [FEEDBACK_CUALITATIVO_SIN_NOTA.md](FEEDBACK_CUALITATIVO_SIN_NOTA.md).

## Decisión

La rama inglesa debe tener **las mismas funcionalidades y comportamiento** que la versión española, con los textos de interfaz, mensajes de error, instrucciones de IA y documentación orientados al inglés. No crear una arquitectura diferente ni volver a investigar desde cero lo ya probado en la rama española.

**Advertencia confirmada:** la información que muestran los mensajes de commits puede no representar fielmente el estado de ambas versiones. Antes de replicar, inspeccionar **archivos, diferencias y comportamiento real** de `main` y `english-version`. No confiar en el nombre de ramas, comentarios o historial como prueba de equivalencia.

## Secuencia pendiente

1. Completar el módulo de feedback cualitativo sin nota en una rama nacida de `main` y ejecutar las pruebas unitarias, integración, interfaz, revisión, publicación y rendimiento.
2. Revisar el diff definitivo y fusionar a `main` solo tras autorización, sin arrastrar cambios no relacionados.
3. Leer ambas ramas reales en su estado actualizado; inventariar archivos que cambiaron y diferencias preexistentes sin perder características particulares.
4. Crear **rama de integración inglesa derivada de `english-version`** para replicar la funcionalidad aprobada, no editar `english-version` directamente.
5. Portar/reutilizar los módulos de servidor, procesadores locales, pruebas y contratos funcionales que sean independientes del idioma; resolver diferencias deliberadamente, sin sobrescribir ciegamente módulos divergentes.
6. Adaptar al inglés las cadenas visibles, el feedback fijo de la IA, motivos de omisión, nombres de secciones, mensajes de errores y los valores predeterminados de plantillas.
7. Mantener `{{calificacion}}` como variable optativa también en las nuevas plantillas inglesas: no incluirla de fábrica. No alterar las plantillas de docentes ya existentes.
8. Verificar paridad real con una misma batería de fixtures y aserciones de comportamiento: entrada con nota, sin nota, rúbrica, sin rúbrica, PDFs, DOCX, PPTX, imágenes, cuestionarios, múltiples archivos, aprobación, publicación sin nota y flujo masivo.
9. Documentar diferencias intencionales por idioma y resultados de pruebas. Fusionar en `english-version` solo tras validación y autorización.

## Matriz de paridad esperada

| Comportamiento | Español (main) | Inglés (english-version) |
|---|---|---|
| Generación con calificación | Misma lógica existente validada | Misma lógica validada, mensajes ingleses |
| Generación sin calificación | Motor separado, sin plantilla | Mismo motor y contratos, sin plantilla |
| Documentos -> Markdown | Conversión local y respaldo visual | Idénticas capacidades y límites |
| Evaluación con/sin rúbrica | Criterios reales o recomendaciones fundamentadas | Mismos criterios; redacción inglesa |
| Valor cero y notas ausentes | Se distinguen | Se distinguen |
| Generación masiva y regeneración | Respeta estados | Mismos estados y garantías |
| Publicación | Comentario sin alterar nota ausente | Igual |
| Plantillas nuevas | Nota no incluida por defecto | Nota no incluida por defecto |
| Calidad, seguridad y rendimiento | Tests aprobados | Tests equivalentes aprobados |

## Protección de ramas

- **No hacer ahora** cambios en `english-version`.
- No asumir que `git cherry-pick` por sí solo equivale a replicar la mejora; evaluar divergencias y traducciones.
- No sobrescribir archivos no relacionados ni usar `push --force`, `reset --hard` o limpieza destructiva.
- No incluir secretos, archivos generados ni trabajo de otras ramas.
- La finalización del trabajo español **no cierra** esta iniciativa: el pendiente inglés debe quedar explícito hasta comprobar la paridad.

## Criterio de cierre

La tarea se considera completada únicamente si ambas ramas integradas contienen las capacidades acordadas, sus pruebas están aprobadas y las diferencias funcionales se reducen a comportamientos deliberados y documentados. Idioma distinto no implica lógica distinta.
