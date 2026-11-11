# Canvas: cinco escenarios pendientes y verificación segura

**Fecha:** 11 de noviembre de 2026. **Rama:** `main` (español). **Publicación:** solo commits locales, sin push.

## Ejecución integrada de las cinco preguntas

La herramienta `tools/qa/remaining_scenarios.py` ejecuta comprobaciones reales o precondiciones de manera puntual, sin abrir navegador, sin instalar recursos permanentes ni reiniciar servicios ajenos:

```bash
cd ~/proyectos/Plugin-Feedback-Canvas-feedback-cualitativo

QA_ALLOW_CANVAS_CAUSAL_LAB=true \
PLUGIN_TEST_MODE=true \
PLUGIN_QA_NO_BROWSER=true \
python3 tools/qa/remaining_scenarios.py \
  --report /home/jaime/qa-feedback-20261110/artifacts/qa-five-remaining-20261111.json
```

La suite consolidadora **no confunde una simulación o un escenario sin reproducir con un E2E real aprobado**. Los resultados se almacenan fuera del repositorio, con permisos restringidos.

| Escenario | Evidencia obtenida | Resultado |
| --- | --- | --- |
| Puerto ocupado por proceso externo | Proceso TCP independiente escuchando en un puerto efímero; comprobación real del instalador detectó el conflicto, no envió señales y el proceso siguió respondiendo | **PASS E2E** |
| Instalación completa interrumpida | Ejecución real de `EnvironmentSetup.ensureSetup()` sobre archivos temporales, con dependencias externas simuladas: primera ejecución falla a mitad de preparación, segunda conserva los artefactos anteriores y completa el flujo | **INTEGRATION_ONLY**; no es todavía una instalación real completa de Canvas |
| Actualizar una base real de Canvas antigua | Comparación de archivos de migración oficiales disponibles y versiones registradas en PostgreSQL QA, dentro de una transacción de solo lectura | **NOT_VERIFIED**; no se ejecutaron migraciones históricas de Canvas |
| Autenticación real con múltiples shards | Consulta de shards existentes: solo hay uno. Decodificación orientativa del ID problemático apunta al shard 10 y al registro local 1 | **NOT_VERIFIED**; no existe entorno multi-shard real |
| Provocar espontáneamente el FK del profesor | Nueve logins headless normales contra Canvas QA, sin modificar controladores ni inyectar la excepción | **NOT_REPRODUCED**; el error sigue sin reproducirse naturalmente |

**Importante:** el hecho de que el identificador global corresponda a un segmento de shard no prueba por sí solo una configuración errónea en la instalación del profesor. La resolución debe confirmarse desde los modelos Rails y la base realmente usada en ese entorno.

### Auditoría de versiones de Canvas

En el laboratorio real:

- 95 archivos de migración en el código, de los cuales uno es específico del entorno `Rails.env.test?`.
- 94 migraciones aplicadas a la base `canvas_development`.
- **0 pendientes y 0 desconocidas**, tras excluir justificadamente esa migración de prueba.

La **opción 6** del menú de validaciones ahora comprueba estos historiales de forma no destructiva, con códigos:

- `CANVAS-DB-HISTORY-OK`: versiones coincidentes.
- `CANVAS-DB-HISTORY-PENDING`: revisión necesaria antes de ejecutar las migraciones oficiales.
- `CANVAS-DB-HISTORY-UNKNOWN`: historial incompatible con el código disponible; no intentar reparación automática.
- `CANVAS-DB-HISTORY-READ`: no fue posible consultar en solo lectura.

Esto **no instala ni actualiza Canvas** y no altera el funcionamiento habitual de la opción 3. El diagnóstico solo se ejecuta al seleccionar la opción 6.

### Métricas de cobertura

Se verificaron los **25 E2E previos**, y se agregó **un E2E nuevo de puertos**: **26/26 E2E comprobados**. Quedan **cuatro cuestiones sin E2E concluyente** de la lista original, diferenciadas en el informe:

`/home/jaime/qa-feedback-20261110/artifacts/qa-compat-all-coverage-20261111.json`

Los dos tests nuevos de interrupción del setup se contabilizan como pruebas **de integración simulada**, no como E2E completos.

### Por qué no se activan migraciones automáticas

La documentación oficial de Canvas indica que la instalación/migración de la base utiliza comandos Rails ejecutados dentro del contenedor Canvas, por ejemplo `bundle exec rake db:migrate`. La aplicación debe mantener respaldo y compatibilidad de configuración/clave de cifrado. No hay garantía de que ejecutar automáticamente una migración sobre una base desconocida sea reversible.

Documentación: https://github.com/instructure/canvas-lms/blob/master/doc/docker/developing_with_docker.md

### Condiciones de cierre todavía necesarias

1. Disponer de una **base de Canvas histórica real, autorizada y desechable**, un código de origen correspondiente y su procedimiento de actualización, para realizar un E2E completo de migraciones y logins.
2. Disponer de un **laboratorio Switchman multi-shard válido** antes de intentar validar cuentas entre shards.
3. Obtener una traza de solo lectura del entorno que falló, o reproducir el error original por autenticación real sin inyección.
4. Ejecutar un arranque interrumpido y reanudado de **una instalación completa desechable de Canvas**, sin afectar los contenedores existentes.

Hasta entonces, el comportamiento seguro sigue siendo **diagnosticar, notificar y bloquear operaciones de datos riesgosas**, sin inventar correcciones de cuentas, términos o shards.
