# Cinco pruebas de plantillas inglesas con Gemini

Copiar el ZIP a Descargas de Windows y ejecutar **una sola línea** en Ubuntu WSL:

```bash
unzip -oq /mnt/c/Users/jaime/Downloads/ejecutar_con_gemini_5.zip -d ~/proyectos/Plugin-Feedback-Canvas-feedback-cualitativo && bash ~/proyectos/Plugin-Feedback-Canvas-feedback-cualitativo/ejecutar-con-gemini.sh
```

Se ejecutan cinco peticiones reales a Gemini, secuencialmente, con la configuración de la aplicación. Usa las tres plantillas por defecto **reales** de PostgreSQL, sin editarlas, un clon en memoria de Standard Class con `{{grade}}` y `{{course_average}}` y un quinto clon con ambas variables ausentes. Las cinco entregas Canvas y las respuestas persistidas se simulan en RAM: **no se crean alumnos, notas, entregas ni feedback en Canvas o PostgreSQL**. Hay lectura de plantillas y configuración existentes. El módulo de conexión de la aplicación puede aplicar su migración habitual de política RLS al inicializar, tal como lo hace al iniciar el servidor. Los archivos de resultados son locales y cada ejecución crea nuevos archivos con fecha y hora, sin sobrescribir el historial.

## Casos

1. **Standard Class:** 94/100, rango `alto`.
2. **Detailed Feedback:** 73/100, rango `medio`.
3. **Peer Review:** 42/100, rango `bajo`.
4. **Standard Class legacy:** 88/100 y promedio de curso sintético 74/100, comprobar resolución de `{{grade}}` y `{{course_average}}`.
5. **Standard Class legacy, sin nota ni promedio:** comprobar eliminación segura de ambas variables y generar feedback con la ruta cualitativa sin nota.

**Limitación identificada:** actualmente la ruta principal sin nota **no usa la plantilla docente seleccionada**; genera feedback mediante `UngradedFeedbackService`. La quinta prueba documenta esta diferencia y verifica la desaparición de variables en un paso separado, sin simular que el flujo aplica esa plantilla. Por ello, no debe interpretarse como validación de aplicación real de la plantilla al feedback sin nota.

El script fuerza una sola solicitud Gemini por caso (sin reintentos internos); si Google rechaza una, el caso aparecerá como fallido y continuarán los otros.

## Resultados

- `logs/gemini-cinco-pruebas-ingles-<fecha>.md`: informe ordenado de los cinco casos, prompt y respuesta completos.
- `logs/gemini-cinco-pruebas-ingles-<fecha>.json`: datos estructurados, sin secretos.

No se muestra la API key, ni se copia a archivos del script o informes. Se recupera mediante el gestor oficial `IAConfigManager` del proyecto.
