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
