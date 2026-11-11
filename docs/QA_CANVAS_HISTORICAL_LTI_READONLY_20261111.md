# Validación LTI histórica — prerequisitos de solo lectura

**Fecha:** 11 de noviembre de 2026

**Repositorio único:** `~/proyectos/Plugin-Feedback-Canvas-feedback-cualitativo`, rama `main` en español. No se modifica el menú interactivo.

## Alcance comprobado

Se extendió el laboratorio de compatibilidad histórica para leer el catálogo de integración LTI **dentro de copias temporales** de PostgreSQL 14 de agosto y octubre.

Las consultas se ejecutan con `PGOPTIONS=-c default_transaction_read_only=on` y `BEGIN TRANSACTION READ ONLY`. Únicamente se informa el número de herramientas públicas, registros que apuntan a `https://localhost:3000`, claves de desarrollador asociadas y el número de coincidencias con el `LTI_CLIENT_ID` actualmente guardado en el archivo privado de QA. **Ningún identificador real, contraseña, token o secreto se escribe en Git.**

### Resultados reales

| Origen | Herramientas LTI públicas | Coincidencias con client_id QA actual | Resultado |
| --- | ---: | ---: | --- |
| Canvas agosto | 1 | 0 | REGISTRATION_REVIEW |
| Canvas octubre | 1 | 0 | REGISTRATION_REVIEW |
| Canvas octubre alternativo | No verificable | — | SCHEMA_BLOCKED |

El backend HTTPS local `https://localhost:3000/health` **no estaba disponible** durante esta auditoría. No se ejecutó un lanzamiento LTI headless ni se modificó la configuración de ninguna cuenta.

**Precaución de causalidad:** en el Canvas QA actual también se observó que el identificador guardado en su archivo `.env` no coincidía directamente con la referencia en `context_external_tools`. Esto puede reflejar un archivo QA desactualizado. **El simple desacuerdo de identificadores no demuestra por sí solo que falle un lanzamiento LTI**, y la herramienta nunca lo clasifica como tal.

## Herramientas y comandos

El lector está integrado como `inspect_lti_catalog` en:

`tools/qa/historical_compatibility_lab.py`

El clasificador independiente está en:

`tools/qa/historical_lti_readiness.py`

Para regenerar los informes se requieren las tres variables de autorización de QA existentes:

```bash
cd ~/proyectos/Plugin-Feedback-Canvas-feedback-cualitativo

QA_ALLOW_HISTORICAL_COMPAT=true PLUGIN_TEST_MODE=true \
PLUGIN_QA_NO_BROWSER=true \
python3 tools/qa/historical_compatibility_lab.py \
  --mode volume --name august-canvas-db \
  --report ~/qa-feedback-20261110/artifacts/historical-compat/august-canvas-db-lti-readonly-20261111.json

QA_ALLOW_HISTORICAL_LTI_READONLY=true PLUGIN_TEST_MODE=true \
PLUGIN_QA_NO_BROWSER=true \
python3 tools/qa/historical_lti_readiness.py \
  --report ~/qa-feedback-20261110/artifacts/qa-lti-historical-readiness-20261111.json
```

Un resultado `REGISTRATION_REVIEW` significa que hay una configuración que merece evaluación, no que una herramienta LTI haya fallado de verdad. Los tests impiden que un catálogo disponible o una respuesta de salud se registren como un lanzamiento exitoso.

## Qué sigue siendo necesario para un E2E verdadero

Debe existir un backend QA del plugin actual **verificado como propio y operativo**. Después, exclusivamente en una **copia aislada** de Canvas:

1. Preparar TLS local y el enlace OIDC seguro con el host correspondiente.
2. Registrar o conciliar la herramienta LTI 1.3 y los valores efectivos de `client_id` y `deployment_id` mediante los mecanismos oficiales del instalador/Rails.
3. Lanzar desde un curso QA con las cuentas sintéticas de administrador y profesor, y comprobar mediante Playwright headless tanto el login de Canvas como el iframe del plugin y la respuesta de sesión.
4. Verificar que las cuentas, términos, claves y demás registros anteriores permanecen íntegros y destruir todos los recursos temporales.

**No ejecutar `DockerLtiConfigurator.cleanDatabase` contra las instalaciones antiguas.** Ese método puede eliminar herramientas previamente registradas; su uso, en caso de ser necesario, deberá aislarse a una base copiada y su resultado deberá ser reversible.

Esta etapa dejó intactos los repositorios históricos, sus claves, los volúmenes originales y el flujo normal. **No representa una demostración LTI completa** ni la reproducción de la excepción FK del profesor.
