# Canvas: validación LTI/OAuth y recuperación aislada — 11/11/2026

**Repositorio:** `~/proyectos/Plugin-Feedback-Canvas-feedback-cualitativo`, rama española `main`.
**Restricciones:** un único clon de implementación, sin tocar el menú interactivo, sin push y sin cambiar los clones históricos ni sus bases de datos originales.

## Autenticación real Canvas → Plugin Feedback

La ejecución `tools/qa/isolated_lti_full_launch.py` emplea copias **desechables** del Canvas histórico de agosto, una base PostgreSQL nueva para Plugin Feedback y un proxy HTTPS local. Las claves OAuth del Canvas copiado se consultan solo en memoria; no se guardan tokens, JWT, contraseñas o URLs con códigos en el reporte.

**Resultado verificado: PASS E2E para administrador y profesor.**

| Verificación | Administrador | Profesor |
| --- | --- | --- |
| POST de inicio de sesión Canvas | HTTP 302 | HTTP 302 |
| Pestaña Feedback / iframe del plugin | PASS / PASS | PASS / PASS |
| Callback OAuth | HTTP 302 | HTTP 302 |
| API `/api/courses` inicial | HTTP 401 esperado | HTTP 401 esperado |
| API `/api/courses` después de OAuth | HTTP 200 | HTTP 200 |
| Interfaz renderizada y no vacía | PASS | PASS |
| FK de Canvas detectada en esta ejecución | No | No |

El `401` inicial corresponde al reto para obtener el token de cada usuario; **no constituye el resultado final**. El criterio de éxito ahora exige callback OAuth exitoso, una respuesta `200` de cursos **posterior** al callback y UI visible por cada rol exigido. El modo `--roles admin` requiere únicamente administrador; `--roles both` requiere ambos roles.

**Evidencia:** `~/qa-feedback-20261110/artifacts/qa-lti-august-api-verified-v2-20261111.json`.

Para repetir la prueba con los recursos originales conservados, sin abrir el menú:

```bash
cd ~/proyectos/Plugin-Feedback-Canvas-feedback-cualitativo
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"
QA_ALLOW_FULL_LTI_E2E=true QA_ALLOW_HISTORICAL_FULL_STACK=true \
QA_ALLOW_ISOLATED_PLUGIN_BACKEND=true PLUGIN_TEST_MODE=true \
PLUGIN_QA_NO_BROWSER=true python3 tools/qa/isolated_lti_full_launch.py \
  --pair august --roles both \
  --report ~/qa-feedback-20261110/artifacts/qa-lti-recheck.json
```

Los recursos con etiquetas QA fueron eliminados y los certificados locales permanecieron sin cambios. Este PASS no certifica el servidor del profesor, ni un Canvas de múltiples shards, ni una instalación completa interrumpida.

## Recuperación real del servicio web Canvas en una copia aislada

Se ejecutó `tools/qa/qa_canvas_restart_recovery_e2e.py` sobre una copia PostgreSQL histórica y un contenedor web desechable. El primer intento mostró un falso bloqueo: tras `docker restart --timeout 8`, Docker reasignó el puerto dinámico publicado. La comprobación antigua seguía consultando el puerto inicial.

Se corrigió la prueba para verificar las etiquetas de propiedad del contenedor y resolver nuevamente el puerto `127.0.0.1` después del reinicio, antes de las consultas de disponibilidad y la prueba con navegador.

**Resultado v3: PASS E2E.** El informe confirmó `hostPortReassigned: true`, `webRecovered: true`, `integrityPreserved: true`, cero términos huérfanos, **7/7** comprobaciones headless de login y `cleanupConfirmed: true`.

**Evidencia:** `~/qa-feedback-20261110/artifacts/qa-canvas-restart-recovery-v3-20261111.json`.

```bash
cd ~/proyectos/Plugin-Feedback-Canvas-feedback-cualitativo
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"
QA_ALLOW_CANVAS_RESTART_E2E=true QA_ALLOW_HISTORICAL_FULL_STACK=true \
PLUGIN_TEST_MODE=true PLUGIN_QA_NO_BROWSER=true \
python3 tools/qa/qa_canvas_restart_recovery_e2e.py --pair august \
  --report ~/qa-feedback-20261110/artifacts/qa-canvas-restart-recheck.json
```

La prueba **no** reclama la recuperación de una instalación Canvas desde cero interrumpida en mitad de sus migraciones; demuestra reinicio del servicio de un Canvas previamente instalado, en una copia.

## Límites pendientes y próximos pasos

- **Error del profesor:** aún no se reprodujo naturalmente `ActiveRecord::InvalidForeignKey` en `Login::CanvasController#create`. La ausencia de FK en estos casos no descarta el fallo en otro servidor.
- **Multi-shard real:** las bases históricas examinadas tienen un solo shard; no se simularon identificadores arbitrarios ni se corrigieron datos del servidor del profesor.
- **Migraciones entre versiones y recuperación del instalador completo:** no certificadas con un E2E destructivo. Requieren una base desechable de versión distinta y un laboratorio apropiado.
- **Verificación del servidor externo:** contrastar mediante el diagnóstico de solo lectura existente, con autorización del profesor, sin ejecutar reparaciones automáticas.

Las pruebas de OAuth/LTI y reinicio usan recursos con nombre y etiquetas de propiedad propios de QA; no hay llamadas para iniciar, editar o borrar los contenedores y volúmenes históricos conservados.
