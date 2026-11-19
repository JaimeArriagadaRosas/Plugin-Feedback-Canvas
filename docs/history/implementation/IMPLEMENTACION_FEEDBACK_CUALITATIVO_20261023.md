# Registro de implementación de feedback sin calificación — 2026-10-23

Rama: `feat/feedback-cualitativo-sin-nota` (desde `main`).
Estado: implementado en rama local, con pruebas automatizadas; requiere prueba manual con Canvas y proveedor IA real antes de integrar en main.

## Cambios
- Bifurcación de generación antes de GradeConverter: puntuaciones ausentes pasan al motor cualitativo; puntuación cero es una nota real.
- Orquestación sin plantilla, sin historial académico ni variables de calificaciones.
- Procesamiento de entrega de texto, adjuntos y datos de respuestas ya disponibles en el objeto Canvas.
- Extracción a Markdown de PDF textual, DOCX, PPTX, TXT, Markdown y HTML; imagen o PDF sin texto a Gemini cuando hace falta.
- Rúbrica opcional e instrucciones de actividad; aviso cuando no hay elementos suficientes.
- Descarga de adjuntos a través del metadata autenticado de Canvas con verificación de orígenes, redirecciones, tamaño y tiempo.
- Persistencia con `plantilla_id` nulo (migración 025) y `nota_canvas` / `nota_chile` nulos.
- SpeedGrader distingue `null` de cero y no comunica una calificación al aprobar feedback sin nota.
- Nuevas plantillas iniciales sin `{{calificacion}}`; se conserva el selector de la variable.
- Cambio de regeneración para incluir profesor, modo regenerar y permitir plantilla nula.
- Instrucción cualitativa separada y sin respuesta inventada cuando falta configuración de IA.

## Pruebas automatizadas ejecutadas
- Suite servidor: 63 aprobadas, 1 omitida (smoke dependiente de integración).
- Suite cliente: 12 aprobadas, 1 Storybook omitida.
- Prueba PDF con PDFKit y pdfjs: aprobada (añadida después de la ejecución de 63 pruebas).
- Compilación Vite del cliente: correcta.
- Primer intento de suite servidor falló por ausencia de dependencia cors en un node_modules compartido; se ejecutó npm ci offline en este worktree y la suite pasó.

## Riesgos y pendientes de verificación manual
1. Ejecutar migraciones y levantar Canvas local. Comprobar un PDF, DOCX, PPTX, imagen, entrega textual y cuestionario real con y sin rúbrica.
2. Confirmar URLs reales de adjuntos Canvas (servidor local o S3/CloudFront) y acceso con identidad del docente. Los hosts externos no autorizados se rechazan deliberadamente.
3. Verificar que Canvas incluye respuestas efectivas en `submission_data` / `answers`; si no las incluye, falta implementar consulta de respuestas al endpoint específico del cuestionario. No comparar preguntas solas.
4. DOCX y PPTX con imágenes o diagramas advierten sobre contenido visual no extraído: no se afirma haberlo evaluado visualmente. Los PDF escaneados requieren Gemini.
5. La petición multimodal está implementada solo para el proveedor Gemini; otros proveedores admiten texto normalizado, no archivos visuales en este flujo.
6. Verificar con profesor que no se modifica la nota ni se publica un 0 ficticio y que revisión y aprobación se conservan.
7. Pruebas con API real y base de datos de Canvas no ejecutadas en esta sesión: no confundir la suite unitaria con validación de producción.
8. Ajustes adicionales para rendimiento, coste y calidad del contenido requieren pruebas con entregas reales.

## Integración al main y versión inglesa
No se hizo push ni merge. No tocar `english-version` antes de validar y fusionar en `main`. Luego replicar exactamente el comportamiento desde código real y traducir textos e instrucciones, según `PARIDAD_VERSION_INGLES.md`.
