# Auditoría de Canvas Local: autenticación, clave foránea y recuperación

**Fecha de ejecución:** 10 de noviembre de 2026 (America/Santiago).
**Estado:** reproducción exacta de la excepción y regresión local realizadas; causa original en el equipo del profesor no determinada.

## Entornos y alcance

- **Instalación histórica:** `/home/jaime/proyectos/Plugin-Feedback-Canvas`, rama `feat/arreglos-y-opcion-5`, commit `a83d9ef`.
- **Clon actual para cambios:** `/home/jaime/proyectos/Plugin-Feedback-Canvas-repro-fk-20261110`, rama `main`, punto de partida `e1d05b2`.
- **Instalación limpia completamente aislada:** `/home/jaime/qa-feedback-20261110/clean/`. Compose y volúmenes independientes, certificados de prueba locales y datos sintéticos.
- **Canvas LMS utilizado:** checkout local `canvas-lms-master`, commit `2e2b4a46`.

Los respaldos de Canvas, PostgreSQL del plugin y configuración se guardaron en `/home/jaime/qa-feedback-20261110/backups/`. Nunca se eliminaron volúmenes del entorno histórico ni se copiaron secretos a Git.

## Evidencia reproducida

1. **Error de PostgreSQL:** inserción de un registro de `terms_of_services` que referencia la cuenta `100000000000001` en una copia de PostgreSQL. Mensaje reproducido: restricción `fk_rails_337ba633a9`, cuenta ausente en `accounts`. Control positivo con una cuenta existente, transacción revertida.
2. **Pantalla Rails idéntica en sus campos técnicos:** POST auténtico desde Playwright a `Login::CanvasController#create`, respuesta HTTP **500**, `ActiveRecord::InvalidForeignKey`, `PG::ForeignKeyViolation`, tabla y restricción correctas. Captura: `/home/jaime/qa-feedback-20261110/artifacts/canvas-login-forced-fk.png`.
3. Para la prueba anterior se inyectó exclusivamente en el clon de Canvas una instrucción temporal activada por una cabecera QA y se restauró el controlador inmediatamente. La restauración fue verificada por SHA-256. **Esto demuestra el mecanismo y la captura, no la causa que lo disparó en la máquina del profesor.**
4. **Controles de autenticación:** administrador y profesor sintéticos obtuvieron HTTP 302 tras POST de login tanto en el entorno histórico como en el limpio. El navegador limpio llegó también a la aplicación React dentro del iframe LTI tras la primera autorización OAuth de Canvas.

## Fallos independientes identificados

- **Colisión de puerto 5432:** otro checkout del plugin mantenía PostgreSQL ligado a ese puerto. El primer arranque histórico no podía iniciar dependencias.
- **Nombres rígidos de contenedores compartidos:** la instalación limpia encontraba contenedores de otros checkouts y bloqueaba el arranque. Se añadieron `PLUGIN_DB_CONTAINER_NAME` y `PLUGIN_GOTENBERG_CONTAINER_NAME` opcionales; los valores predeterminados existentes se mantienen.
- **Variables volátiles tras relectura de .env:** el instalador recarga `.env` y puede reemplazar la configuración proporcionada por consola. Los nombres y puertos diferenciados deben persistirse en el `.env` del checkout.
- **CA local WSL:** el clon no tenía el marcador de una CA previamente confiada. Se utilizó solamente en QA el marcador cuya huella coincidía con el CA local; no se modificó el almacén de Windows.
- **Arnés E2E anterior:** selector de botón ambiguo, credenciales predeterminadas no correspondientes al seed y ausencia del paso de consentimiento LTI; generaban falsos fallos.
- **Conexión Base de Rails en QA:** `search_path` vacío; se requirió calificar `public.terms_of_services` para la inyección. No presupone el mismo fallo en el equipo del profesor.

## Instrumentación añadida al clon actual

- Diagnósticos `CANVAS_TERMS_FOREIGN_KEY` y `HOST_PORT_OCCUPIED`, con mensajes conservadores y sin destrucción automática.
- Aislamiento de contenedores compartidos mediante nombres y puertos configurables.
- Observador del proxy HTTPS para errores 5xx en POST de `/login/canvas`. Solo analiza como máximo 64 KiB, no modifica la respuesta HTTP ni imprime parámetros de autenticación. Si reconoce el fallo de términos de servicio, registra un mensaje de diagnóstico y recomienda conservar los datos.
- Pruebas unitarias para clasificación de logs, aislamiento de contenedores, validación de nombres y conservación de la respuesta del proxy.

## Límites del diagnóstico

La captura del profesor no contiene logs previos, versión exacta, esquema efectivo, información de shard ni detalles de los contenedores. El número `100000000000001` no coincide con las cuentas locales observadas en los entornos validados. No es posible afirmar si surgió de inicialización incompleta, uso de un shard inadecuado o referencia de configuración antigua. La prueba intencional de error no distingue estas causas.

En una investigación en el equipo afectado, solicitar primero evidencias de solo lectura: `accounts`, `settings` relacionadas con cuentas principales, `switchman_shards`, contexto de conexión, revisión de migraciones y logs de Rails en el instante del POST. No eliminar volúmenes ni modificar cuentas antes de establecer una causa.

## Regresión

Desde el clon actual: `npm test`, `npm run lint` y `npm run build`; la batería criptográfica requiere una `ENCRYPTION_KEY` de prueba válida (64 caracteres hexadecimales), nunca una clave de producción.

Capturas y logs se mantienen fuera del repositorio en `/home/jaime/qa-feedback-20261110/`. Los scripts que alteran temporalmente Canvas permanecen solo allí, nunca dentro del código de producción.

## Últimas verificaciones y alcance

- Arranque íntegro de opción 3 en instalación nueva: migraciones, datos sintéticos, backend, Vite, proxy HTTPS, certificados locales, PostgreSQL y Gotenberg independientes completados.
- Login de administrador y profesor desde el Canvas limpio: HTTP 302.
- Playwright E2E: curso 1, enlace Feedback, consentimiento OAuth inicial y aplicación React dentro del iframe LTI: aprobado, con captura archivada fuera de Git.
- Reproducción exacta de la pantalla de Rails en HTTP 500 pasando por el proxy HTTPS: aprobada en entorno desechable.
- Observador HTTP integrado: registró advertencias [CANVAS-LOGIN] en una ejecución real y preservó el HTML devuelto por Canvas.
- Restauración de controlador tras la inyección controlada comprobada: QA_PATCH_INACTIVE.
- El identificador global que figura en la captura del profesor no pudo resolverse mediante Shard.local_id_for en el entorno limpio; esto no prueba cuál fue la causa en el computador del profesor.
- Pendientes: no hay acceso a los logs y estado del entorno del profesor; no se evaluaron exhaustivamente proveedores externos de IA ni todos los flujos de estudiantes y profesores.

Los scripts destructivos de prueba temporal permanecen en la carpeta de evidencia externa, sin incorporarse al código publicado.
