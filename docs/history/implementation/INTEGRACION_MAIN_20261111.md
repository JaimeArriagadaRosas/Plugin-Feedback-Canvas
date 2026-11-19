# Integración local de main — 11 de noviembre de 2026

La rama main (interfaz española) de este clon reúne cuatro commits de trabajo nacidos del mismo commit base e1d05b2:

- 1786d95: opción 6 dentro de Validaciones de Caja Negra (diagnóstico solo lectura).
- c937660: detección de errores de claves foráneas y conflictos de infraestructura.
- ac13ef3: observación del login, informes sin credenciales, recuperación limitada de servicios propios y pruebas headless.
- 80409fe: laboratorio causal de persistencia, configuración antigua y rastreo de shards.

Los commits se conservan en la historia mediante merge local. No se realizó ningún push.

## Alcance funcional y límites

El sistema detecta determinadas inconsistencias, ofrece informes seguros y permite recuperar ciertos servicios propios detenidos mediante activación explícita e identificación estricta del contenedor.

Esto NO garantiza compatibilidad universal con bases de datos ni versiones antiguas de Canvas. No existen migraciones generales automáticas de PostgreSQL, corrección de shards, reconstrucción de cuentas, conversión automática de IDs ni reparación de términos de servicio. Los datos históricos incompatibles requieren un procedimiento oficial de migración o una intervención evaluada.

El inicio controlado de servicios solo se habilita con PLUGIN_ALLOW_OWNED_SERVICE_RECOVERY=true y COMPOSE_PROJECT_NAME inequívoco. La opción 6 nunca modifica datos ni inicia servicios.

## Verificación y próxima publicación

Se ejecutaron las pruebas Vitest, ESLint, compilación Vite y las pruebas Python de seguridad y clasificación sobre esta versión unificada.

Consultar:
- docs/QA_CANVAS_CAUSAL_RECOVERY_20261111.md
- docs/QA_CANVAS_PERSISTENCE_SHARD_LAB_20261111.md
- docs/CANVAS_READONLY_DIAGNOSTICO_20261111.md

Antes de publicar, revisar el estado remoto y obtener permiso explícito para hacer push. El próximo git pull del profesor solo tendrá estas mejoras después de que los commits locales se publiquen efectivamente en GitHub.
