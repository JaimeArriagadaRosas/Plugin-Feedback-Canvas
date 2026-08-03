# Registro de Deuda Técnica (Technical Debt)

Este documento registra las decisiones técnicas conscientes y los compromisos (trade-offs) asumidos durante el desarrollo del plugin, con el objetivo de alcanzar un Producto Mínimo Viable (MVP). Las deudas aquí documentadas no bloquean el funcionamiento actual del software en su estado de desarrollo, pero requieren atención futura para madurar el proyecto hacia un estado de producción completo.

---

## 1. Datos Hardcodeados y Ajustes Visuales en el Renderizado de Entregas (Step 3)

### Descripción
El renderizado de las entregas de los estudiantes en la vista de *feedback* (conocido internamente como "Step 3") presenta información incompleta y/o datos *hardcodeados* (ej. indicador de "Puntaje: N/A").

### Contexto y Justificación
Para la versión actual (MVP), la prioridad se centró en garantizar que la arquitectura de frontend cargara y renderizara la interfaz correctamente utilizando las tecnologías implementadas, demostrando la viabilidad de la vista. La inyección de datos reales y dinámicos para todos los campos detallados no es un bloqueante en esta etapa, por lo que se optó por utilizar datos genéricos o estáticos temporales.

### Estado Actual
- La vista se renderiza correctamente sin errores en el flujo de la aplicación.
- Existen componentes visuales que muestran información estática o de prueba.
- Es posible que falten ajustes visuales finos para adaptar el diseño a diferentes variaciones de los datos reales.

### Acción Requerida (Futuro)
- Integrar y vincular los datos dinámicos provenientes del backend con los componentes de la interfaz.
- Realizar los ajustes visuales necesarios para asegurar que los datos dinámicos se presenten de manera fluida y correcta, reemplazando cualquier valor estático (como el puntaje "N/A").

---

## 2. Validación de Opciones LTI en Entorno de Producción Real

### Descripción
Las opciones principales del menú de configuración orientadas a producción, específicamente:
- **Ejecutar entorno de producción LTI 1.3** (Opción 1)
- **Setup de despliegue LTI** (Opción 2)
 
No han sido probadas de extremo a extremo en un ambiente real de producción.

### Contexto y Justificación
Actualmente, no se ha contado con una *Developer Key* de Canvas LMS que permita validar el ciclo completo en un entorno 100% de producción. Para avanzar con el desarrollo, el entorno local fue configurado para replicar las condiciones de producción lo más fielmente posible, contemplando las variables esperadas. Sin embargo, se incluyeron pequeñas adaptaciones necesarias para que funcionara localmente (por ejemplo, la automatización del proceso de *bypass* para establecer la confianza del plugin), lo cual, en un entorno de producción, sería un proceso regular (usualmente manual o gestionado por el administrador).

### Estado Actual
- El flujo LTI funciona correctamente de manera local mediante la simulación y el *bypass* automatizado.
- Existe incertidumbre sobre el comportamiento exacto de las opciones de despliegue al momento de enfrentarse a un entorno productivo real, al no contar con la validación de la *Developer Key*.

### Acción Requerida (Futuro)
- Obtener una *Developer Key* válida.
- Ejecutar pruebas exhaustivas de despliegue y lanzamiento LTI 1.3 en un entorno de producción real o *staging* de Canvas.
- Validar que el comportamiento simulado en el entorno local coincida con el comportamiento real de producción y refactorizar/eliminar los *bypasses* locales en el código destinado a producción.

---

## 3. Servicio de Envío de Correos Institucionales (EmailService) Incompleto para Producción

### Descripción
El sistema permite a los estudiantes configurar sus preferencias de notificación ("Ambos métodos" o "Correo Institucional") y ejecuta la lógica para procesar esas notificaciones al aprobar feedbacks, pero actualmente **no envía correos electrónicos reales**. En su lugar, simula el envío escribiendo un registro local (`local-emails.log`).

### Contexto y Justificación
Durante el desarrollo del MVP, el entorno local no se conectó a un proveedor SMTP real (ej. SendGrid, AWS SES o servidor de correo de la universidad) para evitar configuraciones complejas, manejo de credenciales y costos asociados al envío de correos durante la fase de pruebas. La arquitectura está diseñada para delegar esta tarea a un `EmailService`, pero su implementación para producción aún no se ha desarrollado.

### Estado Actual
- El módulo `EmailService.local.js` captura correctamente la orden de envío y registra en disco un *Mock Email*.
- No existe una integración funcional con un servidor de correo saliente.
- No existen plantillas HTML (formato, logos, colores institucionales); solo se genera un texto plano en el log para efectos de depuración.

### Acción Requerida (Futuro)
- Desarrollar e implementar un adaptador real para `EmailService` (ej. usando `nodemailer` o el SDK de un proveedor de correos) que se active cuando el plugin esté en un entorno de producción.
- Diseñar e integrar plantillas formales de correo institucional (formato HTML, logos de la institución).
- Configurar las credenciales seguras (variables de entorno) del proveedor SMTP en la infraestructura de producción.

---

## 4. Escala de Exigencia Matemática (60%) Fija por Defecto

### Descripción
Las variables dinámicas del motor de prompt que realizan cálculos matemáticos con las calificaciones, específicamente en `GradeResolver`, `CourseStatisticsService`, y `GradeConverter`, asumen por defecto que las conversiones a la escala chilena (1.0 a 7.0) utilizan una escala de exigencia del 60%.

### Contexto y Justificación
Durante esta fase no se ha integrado la capacidad para que el profesor configure su propia escala de exigencia por tarea o por curso (por ejemplo, 50% o 70%). Para poder entregar métricas semánticas y cálculos de promedio al LLM, se fijó el estándar universitario típico del 60%.

### Acción Requerida (Futuro)
- Adaptar las firmas de los resolvers y del convertidor de notas para recibir la escala de exigencia como parámetro, la cual debería provenir de la configuración del curso en la base de datos o de las preferencias del profesor.

---

## 5. Simulación (Mocking) Local para Variables Globales (UNIDA/SIS)

### Descripción
Los módulos de variables personalizadas creados en la Fase 3 (`OtherCoursePerformanceResolver`, `StudentEntryProfileResolver` y `PreviousAcademicStatusResolver`) consumen datos simulados localmente en lugar de realizar llamadas a las API reales de los sistemas de información estudiantil (SIS/UNIDA).

### Contexto y Justificación
Para permitir el desarrollo y validación del flujo de inyección dinámica sin depender de integraciones externas (que aún no están disponibles para el plugin), se simuló el comportamiento exacto que tendrían en producción. La estructura, las promesas y el comportamiento de Fallback (ignorar silenciosamente la variable si no hay datos) funcionan idéntico a producción, diferenciándose únicamente en el origen de los datos.

### Acción Requerida (Futuro)
- Reemplazar las llamadas locales simuladas en los Resolvers por llamadas reales a los endpoints de la universidad (SIS) cuando estén disponibles en el entorno de producción.

---

## 6. Limitación de Formato de Texto Enriquecido en Canvas LMS

### Descripción
La API nativa de entregas de Canvas LMS (`Submission Comments API`) no soporta etiquetas HTML nativas ni sintaxis Markdown en los comentarios. Todo el contenido enviado se muestra literalmente como texto plano. Debido a esto, se implementó una solución alternativa ("Workaround") que traduce el formato básico de texto (negrita, cursiva) a caracteres Unicode matemáticos antes de enviarlos a Canvas. 

### Contexto y Justificación
Dado que el requerimiento funcional exige enviar formato de texto enriquecido (negritas, cursivas y listas) y la API actual de Canvas restringe esto, la transformación a Unicode fue la forma más eficiente de satisfacer el requerimiento visual sin requerir integraciones LTI complejas (iFrames) para los comentarios, lo que habría modificado la experiencia de uso.

### Estado Actual
- El módulo `RichTextProcessor` transforma la sintaxis básica a caracteres Unicode (ej. `𝗯𝗼𝗹𝗱`).
- Al estudiante **no se le muestra un formato HTML real** en su vista de Canvas, sino caracteres estandarizados que simulan dicho formato.
- La visualización depende enteramente de cómo el navegador y Canvas LMS renderizan la fuente Unicode estándar, lo cual escapa de nuestro control directo (depende de Canvas LMS).

### Acción Requerida (Futuro)
- Cuando Canvas LMS exponga una API nativa para comentarios de texto enriquecido (ej. con soporte oficial HTML/Markdown), esta deuda técnica deberá ser saldada removiendo la conversión a caracteres Unicode.
- Así, los comentarios se cargarán y renderizarán de manera correcta nativamente, dependiendo 100% de la funcionalidad de Canvas LMS y no de la capa de traducción del plugin.
