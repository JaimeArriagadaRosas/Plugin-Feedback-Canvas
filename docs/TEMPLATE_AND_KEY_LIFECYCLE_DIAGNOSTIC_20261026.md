# Diagnóstico previo a las correcciones — 26-10-2026

## Alcance
Solo pruebas nuevas y diagnóstico en el worktree inglés. No se alteraron `.env`, claves, registros PostgreSQL, código funcional ni plantillas. No trasladar a `main` hasta revisión y aprobación.

## Hallazgos confirmados
1. `useTemplateEditor.js` filtra y elimina líneas enteras que contienen `{{course_average}}`, incluyendo texto docente adicional. Hay regresión documentada con `it.fails`, que **no** demuestra reparación.
2. `TemplateRepository.cloneDefaultTemplates` define plantillas base con secuencias de escape anidadas y clona la plantilla predeterminada en la primera sesión. `TemplateManager.getTemplatesForProfesor` consulta `has_seeded_templates`; si es falso, clona y luego marca como creado. Si las bases están contaminadas, nuevas copias también lo estarán. Una modificación del código fuente no arreglaría automáticamente copias ya persistidas.
3. `EncryptionService` usa AES-256-GCM; un fallo genérico de descifrado puede deberse a clave distinta, datos alterados o formato incompatible y no distingue las causas en el registro. `safeDecrypt` devuelve null y no entrega datos corruptos.
4. `KeyManager.ensureKeys` conserva claves de longitud correcta y regenera automáticamente claves inexistentes o de longitud incorrecta. En una DB persistente esto podría volver inaccesibles credenciales anteriores. **No hay evidencia suficiente para afirmar que ocurrió** en esta ejecución; tampoco se inspeccionó el valor de claves reales.
5. El token de Canvas se recuperó mediante OAuth en el log entregado; la credencial Gemini siguió fallando. No se debe considerar equivalente reautorizar Canvas a recuperar Gemini.

## Pruebas preparadas y ejecutadas (12)
- `template-preview-diagnostic.test.js`: 3 casos, uno marcado deliberadamente como fallo esperado; registra filtro y fuente de literales escapados.
- `template-first-session-diagnostic.test.js`: 2 casos; profesor nuevo se clona una sola vez, profesor existente no se vuelve a sembrar.
- `encryption-failure-diagnostic.test.js`: 3 casos con valores sintéticos (ida/vuelta, autenticación alterada, dato malformado).
- `key-lifecycle-diagnostic.test.js`: 4 casos con entorno ficticio (persistencia válida, clave ausente, longitud inválida, conservación).
Todos los grupos completaron ejecución aislada correctamente. Es diagnóstico, no certificación de corrección. **No se ha realizado test real contra DB ni se han validado metadatos de claves históricos.**

## Propuesta pendiente de autorización
A. Un modelo de texto canónico: saltos de línea reales en el editor y la vista previa; serialización JSON solo en transporte y persistencia. En fuente de semillas generar objetos y serializar una vez; jamás exponer literales barra+n al profesor. Pruebas primer ingreso, reingreso, clonación, edición, save/reload, generador de feedback, textos con backslash legítimo y migración de plantillas antiguas sin doble decodificación.
B. Reemplazo de variables opcionales en un motor compartido; nunca descartar texto docente completo al faltar `course_average`. Sin inventar promedios académicos.
C. Conservación o reparación de plantillas persistidas mediante auditoría en solo lectura + copia de seguridad + migración idempotente; no sobreescribir ediciones de profesor. Solo corregir registros afectados tras revisión.
D. Clave de cifrado inmutable por instalación persistente: si falta y existen ciphertexts, bloquear arranque o acceso a secretos en lugar de regenerar silenciosamente; derivar identificador no sensible (fingerprint controlado), versionar ciphertext y metadatos. Rotar exclusivamente con proceso transaccional explícito, backup verificado y re-cifrado; errores acotados sin filtrar secretos. Registrar rutas de OAuth y proveedores de IA por separado.
E. Igualar inglés y español mediante pruebas de contrato y localización. Ninguna modificación de producción hasta aprobación.

## Impacto previsto
- Renderizado/normalización: O(longitud del texto) por plantilla; sin llamadas de red adicionales.
- Tests de plantillas: costo pequeño de CPU; pruebas DB opt-in con fixture aislado.
- Claves: verificación de metadatos ligera en arranque; evitar descifrar y re-cifrar cada credencial en cada solicitud. Una rotación explícita tiene costo O(número de secretos) y debe ser offline/transaccional, no automática.
- Migración de plantillas existentes: O(número de registros afectados), preferiblemente en lotes con auditoría y rollback. No repetir en cada inicio del profesor.
- Las aplicaciones pueden tener una indisponibilidad puntual para secretos inválidos; es preferible a sustituir claves silenciosamente.

## Próximas pruebas necesarias antes de implementar
- Inspección en solo lectura del tipo y formato de los campos `Plantilla_Feedback.contenido` sin recopilar contenido sensible y con autorización.
- Localizar todas las rutas que crean plantillas predeterminadas y comprobar también archivos de migraciones y seeding de Canvas.
- Ensayos simulados de cambios de `ENCRYPTION_KEY`, colisión de versiones, múltiples procesos, reinicio con DB preexistente, errores de actualización parcial, recuperación y doble rotación.
- Crear fixture en base efímera para verificar el comportamiento de primera sesión; no experimentar con la DB real.
