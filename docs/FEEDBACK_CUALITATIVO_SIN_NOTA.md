# Plan de implementación: feedback cualitativo sin calificación

**Estado:** diseño acordado; implementación pendiente.
**Fecha de registro:** 2026-10-23.
**Rama de trabajo:** `feat/feedback-cualitativo-sin-nota`, creada desde `main` en `5897dd55c1aaa771b35e7de1cbaa5bb6b8887eab`.
**Ámbito:** primero la versión española (`main`). La réplica funcional en `english-version` es una fase posterior obligatoria; véase [PARIDAD_VERSION_INGLES.md](PARIDAD_VERSION_INGLES.md).

## 1. Decisiones confirmadas

1. Crear un **motor independiente** para entregas existentes **sin calificación ni puntaje**, en lugar de forzar el flujo que ya utiliza calificaciones, plantillas e historial.
2. Mantener **sin alterar el comportamiento del motor calificado** salvo el punto de bifurcación y adaptaciones comunes necesarias.
3. El nuevo motor **no utiliza plantillas** del profesor, variables dinámicas, historial de notas ni clasificación por niveles de calificación.
4. La IA analiza evidencia real de la entrega. Aplica la rúbrica cuando exista y, sin ella, usa instrucciones y objetivos de la actividad. Sin esas referencias, solo ofrece recomendaciones generales fundamentadas, sin fingir criterios.
5. **Markdown será el formato intermedio preferente** para los documentos textuales, generado localmente para evitar una llamada adicional a IA. Si la dimensión visual es necesaria, se adjuntan imágenes o un PDF a la evaluación.
6. En el caso habitual, **una sola petición al proveedor de IA** para evaluar el contenido preparado y producir feedback. No crear una fase IA adicional de extracción por defecto.
7. El feedback resultante se guarda, se revisa y se aprueba mediante el circuito existente; **no asigna, genera ni envía una nota** a Canvas.
8. Independientemente de este flujo, **las nuevas plantillas calificadas dejarán de insertar `{{calificacion}}` por defecto**. La variable seguirá disponible para inclusión voluntaria del docente. Las plantillas existentes no se migran automáticamente.
9. No confundir **nota igual a cero** con **ausencia de nota**. No confundir falta de nota con ausencia de entrega.
10. Tras implementar y validar la versión española en `main`, llevar la misma funcionalidad a `english-version` con localización correcta y pruebas de equivalencia, sin confiar en mensajes de commits como prueba de paridad.

## 2. Estado actual a preservar

El punto de entrada está en `apps/server/src/services/FeedbackGenerationService.js`: `generateFeedback` obtiene datos de Canvas, ejecuta `GradeConverter.processGrade(currentGrade, submission)` y, ante error 422, omite con el mensaje "Este estudiante no ha entregado". Ese diagnóstico es incorrecto si sí existe una entrega pendiente de calificar.

En el flujo actual también intervienen `FeedbackService.js`, `PromptManager.js`, `services/calificaciones/GradeConverter.js`, `services/variables/GradeResolver.js`, `FeedbackPersistenceHandler.js` y proveedores bajo `services/ia/`. Los resolvers históricos no sustituyen el contenido real de la entrega. La evidencia debe obtenerse explícitamente.

En la interfaz, `apps/client/src/views/speedgrader/hooks/useSpeedGraderData.js` trata actualmente algunas ausencias de nota como cero; revisar esa normalización. `useSpeedGraderActions.js` y la publicación/aprobación deben garantizar que enviar solo un comentario no publique nota cero. La base de datos ya admite notas nulas; verificarlo antes de introducir migraciones innecesarias.

## 3. Bifurcación propuesta

```text
Solicitud individual o masiva / evento Canvas
  └─ Validar autorización, actividad y entrega real
      └─ Leer calificación de Canvas / override válido
          ├─ Hay nota: motor calificado actual (plantillas y resolvers)
          ├─ No hay nota, sí hay contenido evaluable: motor cualitativo nuevo
          └─ No existe entrega / evidencia insuficiente: omitir con motivo correcto
```

La bifurcación ocurre **antes de ejecutar GradeConverter**. Considerar los campos reales de Canvas (`score`, `entered_score`, `unposted_score`) y las anulaciones explícitas con semántica clara; no usar `if (score)` ni convertir `null` a `0`. No generar retroalimentación personalizada de una entrega inexistente.

## 4. Arquitectura propuesta

En `apps/server/src/services/feedback/`, con responsabilidades aisladas:

| Componente propuesto | Responsabilidad |
|---|---|
| `UngradedFeedbackService.js` | Orquestar autorización, lectura, preparación, evaluación y persistencia sin calificación. No duplicar el circuito de revisión/aprobación. |
| `SubmissionContentProcessor.js` | Detectar el tipo de entrega de Canvas, descargar adjuntos autorizados y delegar en extractores/adaptadores. Mantener procedencia y errores por adjunto. |
| `DocumentToMarkdownConverter.js` | Convertir localmente contenido textual de PDF, DOCX, PPTX y HTML/texto a Markdown estructurado. Extraer tablas, encabezados, páginas y diapositivas si es posible. |
| `VisualContentDetector.js` | Determinar, por reglas verificables y señales del extractor, cuándo la extracción textual es insuficiente; conservar evidencia visual relevante. No prometer detección perfecta. |
| `RubricContextBuilder.js` | Recoger rúbrica, criterios, descripciones, instrucciones y objetivos de la tarea; priorizar rúbrica existente sin convertirla en una nota. |
| `QualitativeFeedbackEvaluator.js` | Preparar instrucciones fijas del nuevo flujo y hacer preferentemente una única petición al proveedor compatible. No consultar plantillas. |
| `FeedbackResponseNormalizer.js` | Validar que el feedback esté fundamentado, tenga secciones útiles y no publique puntuaciones ni afirmaciones sin evidencia. |

Los nombres son una propuesta de división; revisar interfaces y DI del repositorio antes de implementarla. Reutilizar `CanvasLmsAdapter`, `SubmissionFacade`, `AssignmentFacade`, configuración de IA, repositorio de feedback, validación de estados y persistencia existentes donde corresponda. Evitar acoplar la conversión de documentos a los componentes del motor calificado.

## 5. Ingesta y normalización según tipo de entrega

| Fuente Canvas / archivo | Ruta preferente | Alternativa |
|---|---|---|
| Texto escrito en Canvas / HTML | Sanitizar y convertir a Markdown | Informar si el contenido está vacío |
| PDF con texto | Extraer localmente texto, títulos, tablas y páginas a Markdown | Adjuntar PDF/páginas relevantes si lo visual es esencial |
| PDF escaneado | Detectar ausencia o baja calidad de texto | OCR o lectura visual multimodal según capacidades disponibles |
| DOCX | Leer estructura, párrafos y tablas a Markdown | Convertir a PDF para preservar gráficos/composición |
| PPTX | Extraer texto por diapositiva y notas pertinentes a Markdown | Convertir a PDF o imágenes si importan diseño, diagramas o gráficos |
| Imágenes | Usar entrada multimodal con origen identificado | No inventar contenido textual no verificable |
| Varios archivos | Mantener cada archivo y su procedencia, consolidar bajo presupuesto | Seleccionar evidencias y declarar limitaciones por tamaño |
| Cuestionario | Recuperar las **respuestas efectivas** del estudiante, no solo preguntas | Si no están disponibles, no simular evaluación de respuestas |
| URL u otro tipo | Obtener solo recursos accesibles/autorizados y compatibles | Informar insuficiencia de evidencia sin fabricar feedback |

El Markdown intermedio debe conservar marcas de procedencia como archivo, página/diapositiva/sección, además de tablas y estructura relevante. Registrar fallos de conversión por archivo y prevenir que texto externo de la entrega se interprete como instrucciones privilegiadas para el modelo.

**Regla de costos:** conversión local primero; evaluación multimodal solo cuando la pérdida visual sea relevante. Markdown puede ahorrar procesamiento visual, pero no garantiza menos tokens ni menor costo para todo PDF/proveedor. Medir calidad, latencia y uso real.

**Límites de seguridad:** verificar MIME real y tamaño, cuotas de páginas/tokens, permiso de acceso al archivo, descargas con URL/cabeceras autorizadas, conversores aislados y temporales con limpieza, evitar SSRF y fugas de datos estudiantiles. Si el proveedor activo no admite imágenes/PDF, no afirmar que sí; ofrecer ruta compatible o error claro.

## 6. Rúbrica e instrucciones

- **Con rúbrica:** comparar observaciones comprobables con cada criterio relevante; destacar fortalezas, faltantes y mejoras accionables, sin calcular puntaje.
- **Sin rúbrica pero con instrucciones:** comentar grado de alineación con objetivo y requisitos observables; distinguir requisitos explícitos de sugerencias.
- **Sin rúbrica ni instrucciones suficientes:** evaluación general de calidad sustentada en el documento (claridad, organización, coherencia, argumentación, legibilidad), señalando límites.
- **Sin contenido interpretable:** no crear elogios ni defectos genéricos falsamente personalizados. Devolver fallo o solicitud de revisión manual con razón específica.

La instrucción de evaluación será **fija y separada del sistema de plantillas**, mantenida en código/configuración versionada. Salida esperada: breve resumen del trabajo, fortalezas verificables, mejoras priorizadas con evidencia, acciones concretas y advertencias de límites. Nunca redactar una nota ficticia.

## 7. Integración transversal a revisar

1. `FeedbackGenerationService.js` / servicio de fachada: derivar sin nota al nuevo motor antes de la conversión y sin requerir `templateId` en esa ruta.
2. `FeedbackController.js`, rutas y validación: contrato explícito para modo automático o falta de nota; distinguir 0, nulo, valor no proporcionado y overrides; autorización y manejo de errores.
3. SpeedGrader: representar `Sin calificar` como `null`, permitir generación sin plantilla y dejar revisar contenido sin capturar una nota ficticia.
4. `FeedbackPersistenceHandler.js` y repositorio: conservar `nota_canvas=null` y `nota_chile=null`; diferenciar origen cualitativo en metadatos si aporta trazabilidad, evaluando necesidad real de esquema nuevo.
5. `FeedbackMutationService.js` / `FeedbackWorkflowService.js`: aprobar y publicar **solo comentario** cuando no hay nota, sin generar actualización de nota en Canvas; revisar regeneración, aprobación masiva y estados.
6. Orquestación masiva: procesar de modo independiente entregas calificadas y no calificadas, respetando idempotencia, estado y fallos parciales.
7. Webhooks: diferenciar evento de nueva/actualizada entrega del cambio de nota; si se automatiza este flujo, la ausencia de nota no debe bloquear `submission_updated`.
8. Proveedores IA: comprobar entrada multimodal por proveedor y aplicación real de instrucciones de sistema; conservar un resultado legible incluso si hay error y **no generar texto de evaluación ficticio como fallback**.
9. Plantillas calificadas: eliminar `{{calificacion}}` exclusivamente de los **valores iniciales de nuevas plantillas** (`apps/client/src/views/plantillas/hooks/useTemplateEditor.js` y defaults adicionales), pero conservarla en selector/resolver. No reescribir plantillas persistidas.

## 8. Etapas y aceptación

### Etapa A — Contratos y selección de motor
- Crear selección sin nota antes de `GradeConverter` y desacoplar `templateId` del nuevo flujo.
- Casos: 0 numérico válido, nota presente, nota nula, no entregado, envío parcial y reintentos.
- Proteger invariantes del flujo calificado.

### Etapa B — Extractores locales y contenido
- Implementar normalización Markdown por formato; recuperar archivos Canvas autorizados y respuesta real de cuestionarios cuando esté disponible.
- Conservar estructura/procedencia; límites de archivos, errores, limpieza temporal.
- Añadir fallback visual con detección y soporte por proveedor; no OCR masivo por defecto.

### Etapa C — Evaluación cualitativa
- Construcción de contexto rúbrica/instrucciones y evaluación con una petición de IA donde baste.
- Normalizar y comprobar respuesta; no usar plantillas ni historial académico.
- Tests con rúbrica, sin rúbrica, sin instrucciones, con contenido insuficiente y con imágenes.

### Etapa D — Integración de extremo a extremo
- UI con `null`, revisión y publicación de comentario sin modificar la calificación.
- Generación masiva, regeneración, errores por archivo, validación de seguridad.
- Ajuste independiente de defaults en editor de plantillas: `{{calificacion}}` optativa, no insertada de fábrica.

### Etapa E — Validación de calidad y rendimiento
- Matriz de archivos: PDF nativo/escaneado, DOCX, PPTX con gráficos, imágenes, texto, cuestionarios, URL y adjuntos múltiples.
- Verificar que el comentario refleje el contenido real; criterios de rúbrica correctamente interpretados; no alucinaciones.
- Comparar extracción a Markdown versus envío de PDF/imagen cuando proceda, midiendo latencia, tokens facturados, tasa de fallo, pérdida visual y calidad.
- Ejecutar pruebas unitarias, integración Canvas simulado y regresión de flujo calificado; revisión humana antes de merge.

### Etapa F — Integración a main y paridad inglesa
- Integrar en `main` **solo después de validación y autorización de integración**.
- Acto seguido replicar cambios funcionales probados en `english-version`, traducir textos e instrucciones fijas y repetir pruebas. No dar por hecho que la rama inglesa está sincronizada por sus commits; comparar código y comportamiento reales. Detalles en [PARIDAD_VERSION_INGLES.md](PARIDAD_VERSION_INGLES.md).

## 9. Exclusiones y pendientes deliberados

- No implementar todavía ningún código de esta funcionalidad: este registro solo fija arquitectura y pruebas.
- No crear plantillas específicas sin nota ni modificar en masa plantillas guardadas.
- No alterar, completar ni publicar notas de estudiantes en la ruta cualitativa.
- No asumir que una conversión de archivo es fiel sin medirla.
- No sincronizar ni publicar la rama inglesa antes de validar `main`.
- No iniciar `git push`, merge o despliegue como consecuencia automática de esta documentación.

## 10. Estado del plan

**Registrado, pendiente de implementación.** Próximo paso técnico: implementar Etapa A y los contratos de ingesta, luego pruebas para cada etapa sin perder este diseño ni la deuda de paridad inglesa.
