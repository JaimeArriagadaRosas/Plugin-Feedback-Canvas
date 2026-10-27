# Auditoria de plantillas espanolas - 2026-10-27
Rama: main. Fallo original: creacion SQL con parametros deducidos incompatibles, previamente reparado en b3661e4.

## Nuevo defecto reproducido
Profesor con una plantilla predeterminada y otras dos ausentes: el manager consideraba la biblioteca inicializada, sin completar las faltantes.

## Correccion implementada
hasLocaleTemplateRecord exige tres nombres predeterminados distintos. Incluye filas soft-deleted en el conteo para preservar eliminaciones intencionadas. cloneDefaultTemplates inserta exclusivamente las filas ausentes y mantiene el bloqueo y la transaccion existentes.

## Evidencia
Suite aislada PostgreSQL 15: 10/10 aprobadas con RUN_DOCKER_TESTS=true. Pruebas nuevas: distintos docentes, reingresos, cinco inicios simultaneos, plantillas personalizadas, reparacion parcial, soft delete, metadatos previos, JSON y separacion por profesor.
Suite npm test: 321 aprobadas, 11 omitidas (las pruebas PostgreSQL ejecutadas separadamente se omiten sin RUN_DOCKER_TESTS).
ESLint: aprobado.

## Pendientes
Validacion de interfaz LTI, flujos de edicion/previsualizacion/asignacion, inyeccion de fallos de transaccion y evaluacion inglesa aislada. No se han borrado bases de datos ni contenedores persistentes.
