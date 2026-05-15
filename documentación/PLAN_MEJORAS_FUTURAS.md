# Plan de Mejoras Futuras - Plugin de Feedback

Este documento detalla la hoja de ruta para fortalecer la calidad, seguridad y mantenibilidad del código en las próximas iteraciones.

## 1. Documentación de Código (JSDoc)
**Objetivo**: Facilitar el mantenimiento y el onboarding de nuevos desarrolladores.
- **Acción**: Implementar estándares de JSDoc en todas las clases y métodos de las capas de controlador, servicio y repositorio.
- **Detalle**: Definir tipos de parámetros, valores de retorno y excepciones lanzadas. Generar documentación estática mediante herramientas como `TypeDoc` o `JSDoc`.

## 2. Estrategia de Pruebas (Testing)
**Objetivo**: Garantizar la estabilidad del sistema ante cambios y nuevas funcionalidades.
- **Tests Unitarios**: Utilizar `Vitest` o `Jest` para probar la lógica de orquestación en `FeedbackService` y los transformadores de `PromptManager` de forma aislada.
- **Tests de Integración**: Validar la interacción entre los repositorios y la base de datos PostgreSQL utilizando una instancia de prueba.
- **Mocks de Canvas**: Expandir el sistema de mocks para simular diversos escenarios de error en la API de Canvas.

## 3. Observabilidad y Logging Avanzado
**Objetivo**: Mejorar la capacidad de diagnóstico y auditoría en producción.
- **Librería**: Implementar `Winston` o `Pino` para reemplazar los `console.log`.
- **Estructura**: Definir niveles de log (`info`, `warn`, `error`, `debug`) y formatos estructurados (JSON) para su fácil integración con herramientas de análisis de logs (ELK, Datadog, etc.).
- **Trazabilidad**: Incluir IDs de correlación por cada petición LTI para rastrear el flujo completo del feedback.

## 4. Validación de Entradas Robusta
**Objetivo**: Prevenir ataques de inyección y errores de datos mal formados.
- **Librería**: Adoptar `Zod` o `Joi` para definir esquemas de validación.
- **Implementación**: Validar cada petición en la capa de controladores antes de procesarla en los servicios. Asegurar que los IDs de Canvas y los contenidos de las plantillas cumplan con los formatos esperados.

## 5. Rate Limiting y Protección contra Abuso
**Objetivo**: Proteger los recursos de la API y controlar costos de los servicios de IA.
- **Acción**: Implementar `express-rate-limit` para restringir el número de peticiones por usuario/IP.
- **Cuotas de IA**: Establecer límites diarios de generación de feedback por curso para evitar el consumo excesivo de tokens de Gemini/OpenAI.

## 6. Auditoría y Cumplimiento
- **Detalle**: Ampliar el `AuditRepository` para registrar no solo acciones, sino también cambios en el estado de las configuraciones críticas del plugin.
