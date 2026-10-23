# Pruebas integrales sin nota y manejo de puertos

## Gestión de puertos aprobada
- Registrar qué servicios inicia el test y cuáles encuentra existentes.
- Reutilizar Canvas 8080, backend 3000, Vite 5173, proxy TLS 8443 y PostgreSQL 5432 cuando ya funcionan y corresponden al proyecto.
- Al finalizar, incluso ante error o señal, detener **solo los procesos iniciados por el propio test**; verificar la liberación de sus puertos. No terminar servicios preexistentes.
- Pendiente de implementación independiente en preboot: identificar PID/comando/carpeta, reutilizar servicios compatibles, ofrecer confirmación interactiva para cerrar servicios ajenos, nunca cerrarlos silenciosamente.

## Cuatro etapas de validación
1. Archivos: inventariar todas las entregas sin nota con PDF/PPTX/DOCX/imagen. Ejecutar preflight y generación individual con una petición por caso; no usar generación masiva.
2. Texto: seleccionar una entrega online_text_entry sin calificación; comprobar texto, rúbrica, generación y borrador.
3. Cuestionarios: verificar si la API devuelve las respuestas concretas. Las semillas califican controles automáticamente: no cambiar notas solo para forzar pruebas; preparar prueba de recuperación y documentar ausencia de un control sin nota si aplica.
4. Negativos: archivos ZIP/XLSX, no entregado, vacíos y formatos dañados deben devolver error controlado sin invocar IA.

## Evidencia actual
- Pedro curso 1 tarea 2 estudiante 8: PPTX 32154 bytes, feedback Gemini generado 2433 caracteres.
- Ana curso 2 tarea 5 estudiante 9: PDF 3334 bytes, 1792 caracteres convertidos; Gemini 503 Service Unavailable; reintento pendiente.
- Selector administrador: openai, anthropic, gemini, otros. No confundir anthropic con claude en la fábrica; revisar luego compatibilidad.

## Criterios de seguridad
No publicar notas, comentarios ni feedback automáticamente en Canvas; conservar borradores. Una solicitud máxima por invocación controlada; sin reintentos; no incluir credenciales en logs. No asumir que todas las entregas tienen puntuación nula ni que todas las extensiones son admitidas.

## Resultados de ejecución de las cuatro etapas
- Inventario real: tres profesores, cinco cursos, quince tareas, 17 entregas sin nota: 10 archivos y 7 textos. Cero cuestionarios sin nota.
- Archivos: Pedro/PPTX aprobado con Gemini; Ana/PDF convertido, generación bloqueada por HTTP 503; segundo PDF (curso 3, tarea 8, estudiante 7) convertido con 1792 caracteres, preparado para IA.
- Texto: curso 2, tarea 6, estudiante 6, 866 caracteres recuperados. Gemini generó 1902 caracteres y guardó borrador ID 4 sin publicar ni asignar calificación.
- Cuestionario: curso 1, tarea 1, estudiante 6, cuatro preguntas accesibles; score presente y respuesta individual ausente en objeto de submission. Falta consultar Quiz Submission y su endpoint de respuestas, sin alterar las notas.
- Negativos: ZIP curso 1/tarea 2/estudiante 6 (48 bytes) y XLSX curso 5/tarea 14/estudiante 10 (8773 bytes): ambos se descargan y fallan antes de IA con DomainError 422 ATTACHMENT_UNREADABLE, Formato no convertible. Son bloqueos esperados, no feedbacks válidos.
- Durante estas pruebas no se inició backend/proxy/Vite desde el test: ya estaban abiertos mediante opción 3. Por tanto no se cerraron los puertos compartidos; la terminación de procesos propios es el criterio de cierre. No se verificó apagado automatizado porque no se lanzaron servicios propios.

## Próximos trabajos
- Recuperación real de respuestas de quizzes y caso sin nota reproducible.
- Probar el resto de adjuntos con Gemini individual, sin reintentos masivos, cuando se disponga del proveedor.
- Normalizar salida esperada ZIP/XLSX: reportar resultado de prueba negativa sin stack trace de excepción no controlada.
- Optimizar doble lectura en el script generate; test de shutdown aislado que inicie y termine sus propios servicios.
- Fase posterior: proveedores de interfaz openai, anthropic, gemini y otros; discrepancia identificadores anthropic/claude.

## Ajustes y verificación posteriores (2026-10-23)
- Se agregó `preparedContent` opcional a `UngradedFeedbackService.generate()` para reutilizar la conversión que ya hizo el ejecutable, evitando descargar el mismo archivo dos veces en ese flujo. Los demás consumidores conservan el comportamiento anterior.
- El ejecutable `feedback-e2e.mjs` devuelve `EXPECTED_REJECTION` para adjuntos ilegibles, contenido vacío o falta de entrega; formato ZIP y XLSX comprobados con HTTP 422 y cero consultas al proveedor.
- Se investigó `/api/v1/courses/1/quizzes/1/submissions`: Canvas local devolvió HTTP 500 al intentar consultar respuestas, mientras que los cuatro enunciados sí están accesibles y la entrega ya tiene nota. Por tanto, **no está validada** la extracción de respuestas ni el caso de cuestionario sin nota. No alterar calificaciones existentes para simularlo.
- El test integral se conecta a servicios ya existentes; no inicia puertos por su cuenta. No terminar servicios compartidos al finalizar. El análisis de gestión inteligente de puertos de preboot sigue documentado como propuesta, sin implementación.
- Pendiente: implementar consulta de respuestas fiable para Classic/New Quizzes según evidencia del LMS, caso de cuestionario sin nota reproducible, segunda evaluación del PDF con proveedor disponible, y prueba E2E de un ciclo de servidor iniciado y cerrado exclusivamente por el test.

## Investigación adicional cuestionarios
- Rails runner sobre Canvas local, solo lectura: `Quizzes::QuizSubmission.where(quiz_id: 1)` recuperó cuatro intentos (estudiantes 6, 7, 8 y 9); cada uno tiene cuatro elementos en `submission_data`.
- La API `GET /api/v1/courses/1/quizzes/1/submissions?include[]=submission` responde HTTP 500. El bloqueo es del acceso REST; no faltan respuestas en Canvas.
- No conectar el motor del plugin directamente al PostgreSQL interno de Canvas como solución general: se requiere un adaptador REST compatible con Canvas remoto. Evaluar las rutas de quiz submission y de preguntas/respuestas del intento, reparar el 500 local si corresponde y construir un test de contrato con evidencia real.
- No se modificaron notas ni intentos del control.
