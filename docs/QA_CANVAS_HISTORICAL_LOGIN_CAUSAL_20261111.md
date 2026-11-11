# Matriz causal de autenticación histórica de Canvas

**Fecha:** 11 de noviembre de 2026. **Repositorio de implementación único:** `Plugin-Feedback-Canvas-feedback-cualitativo` en la rama española `main`.

Este laboratorio trabaja exclusivamente desde comandos bajo `tools/qa`. **No se modifica el menú interactivo** ni los clones históricos. La herramienta es puntual: no instala demonios, tareas programadas ni procesos permanentes.

## Objetivo

Comprobar el inicio de sesión real en Canvas contra volúmenes históricos y separar rigurosamente:
- Incompatibilidad de configuración/datos que causa HTTP 500.
- Excepción PostgreSQL `PG::ForeignKeyViolation` en `terms_of_services`.
- Fallo de la integración Plugin Feedback (LTI).
- Esquema Canvas histórico incompleto.

**Esos cuatro síntomas no son equivalentes.** Un HTTP 500 al consultar `GET /login/canvas` NO reproduce la excepción original del profesor, que apareció durante `POST /login/canvas`.

## Entorno implementado

`tools/qa/historical_full_stack.py` verifica que cada web y PostgreSQL original sigue siendo el contenedor correcto y está detenido. Crea una red Docker de nombre aleatorio `qa-hpair-*`, clona el volumen de PostgreSQL 14 montando la fuente en modo `readonly`, inicia contenedores PostgreSQL/Redis/Rails y publica únicamente la web en un puerto efímero vinculado a `127.0.0.1`.

El código Canvas y los volúmenes de gems originales se montan **en solo lectura**. Los logs y archivos temporales de Rails se guardan en volúmenes nuevos. Una prueba de esquema ejecuta SQL con `BEGIN TRANSACTION READ ONLY` y `PGOPTIONS=default_transaction_read_only=on` antes de permitir el arranque web.

El laboratorio utiliza la contraseña sintética de administrador Canvas del `.env` privado de QA; ninguna contraseña, `ENCRYPTION_KEY` ni contenido completo de logs Rails se incorpora al informe o a Git. Chromium se ejecuta con `headless: true` y `QA_INJECT_FK=0`.

**El Docker bridge es privado para cada prueba y publica solo el localhost del anfitrión. No debe confundirse con una red con salida a Internet técnicamente prohibida.** No se expone PostgreSQL ni Redis.

El programa elimina por `finally` los recursos desechables y exige etiquetas de propiedad para cada eliminación. Nunca llama `docker start` sobre un servicio histórico ni realiza migraciones de Canvas.

## Matriz ejecutada

| Escenario | Código web Canvas | Datos PostgreSQL | Clave de cifrado aplicada | Resultado |
|---|---|---|---|---|
| Agosto normal | Agosto | Agosto | Agosto | HTTP 200; login headless 7/7 |
| Octubre normal | Octubre | Octubre | Octubre | HTTP 200; login headless 7/7 |
| Cruce A | Agosto | Octubre | Agosto | **HTTP 500 en GET**, antes del POST |
| Cruce B | Octubre | Agosto | Octubre | **HTTP 500 en GET**, antes del POST |
| Control A | Agosto | Octubre | Octubre | HTTP 200; login headless 7/7 |
| Control B | Octubre | Agosto | Agosto | HTTP 200; login headless 7/7 |
| Base incompleta | Octubre | Octubre alternativa | Octubre | **Bloqueo seguro**, Rails no arranca |

Las dos copias Canvas tienen exactamente la **misma revisión de Git** (`2e2b4a46d08e`) pero claves `ENCRYPTION_KEY` distintas. Los controles prueban que el HTTP 500 cruzado se evita al mantener la clave correspondiente a los datos históricos, sin modificar esas bases. **No corresponde atribuir el resultado a una diferencia de versión del código Canvas**.

Se mantuvieron 0 excepciones FK confirmadas en los controles con lectura de logs Rails y 0 reproducciones de `Login::CanvasController#create` con la FK original. El primer ensayo de agosto verificó la respuesta del navegador, pero su inspección específica de logs no fue concluyente; se registra como `null`, no como ausencia probada de errores.

### Intento adicional con perfil de profesor

Se ejecutó un login normal con la cuenta **sintética de profesor** en los
laboratorios de agosto y octubre, incluyendo el flujo de cookie alterada y
recuperación de sesión. Ambos obtuvieron **HTTP 200 y 7/7 comprobaciones
headless satisfactorias**. Los logs Rails y Docker de las copias no contuvieron
la firma de `terms_of_services` con `ActiveRecord::InvalidForeignKey` ni la
restricción `fk_rails_337ba633a9`. La causa exacta del incidente del
profesor, por tanto, **no quedó reproducida**.

Estos dos ensayos adicionales son pruebas de Canvas contra PostgreSQL
histórico, no pruebas de LTI cruzado con el plugin actual.

Los propios tests de Canvas condicionan el soporte multi-shard a la presencia
de un plugin adicional de multitenencia (`spec/sharding_spec_helper.rb`);
con los repositorios observados y un solo shard por base, no se intentó
simular un multi-shard insertando registros falsos.

### Ejecución individual

```bash
cd ~/proyectos/Plugin-Feedback-Canvas-feedback-cualitativo
export QA_ALLOW_HISTORICAL_FULL_STACK=true
export PLUGIN_TEST_MODE=true
export PLUGIN_QA_NO_BROWSER=true
export QA_DIR=~/qa-feedback-20261110/artifacts

python3 tools/qa/historical_full_stack.py \
  --pair august --report "$QA_DIR/qa-historical-pair-august-20261111.json"
python3 tools/qa/historical_full_stack.py \
  --pair october --report "$QA_DIR/qa-historical-pair-october-20261111.json"
python3 tools/qa/historical_full_stack.py \
  --pair august-web-october-data-matched-key \
  --report "$QA_DIR/qa-historical-pair-august-web-october-data-matched-key-20261111.json"

python3 tools/qa/historical_pair_matrix.py \
  --output "$QA_DIR/qa-historical-pair-matrix-20261111.json"
```

El ejecutor también acepta `--role professor` o `--role student` para ejecutar los mismos flujos con cuentas sintéticas de QA y credenciales locales protegidas; por defecto utiliza `--role admin`. El rol profesor usa el escenario de cookie alterada y recuperación de sesión, no un error de FK inyectado.

Los nombres adicionales son `august-web-october-data`, `october-web-august-data`, `october-web-august-data-matched-key` y `october-incomplete`. Cada escenario tiene una condición de salida acotada y deja sus informes en QA, fuera de Git.

Los tests unitarios de esta herramienta están en `tools/qa/tests/test_historical_full_stack.py` y `test_historical_pair_matrix.py`.

## Recuperación verificada frente a reparación automática

**Se demostró que la continuidad de la clave recupera los logins en copias de laboratorio**. No se recomienda reemplazar automáticamente `ENCRYPTION_KEY` en producción: esa clave debe tratarse como secreto crítico, respaldarse y asociarse a la base correspondiente. Cambiarla por otra no equivale a ejecutar una migración.

Para el instalador, la política conservadora es **diagnosticar e informar** de posibles incompatibilidades de configuración y evitar reescrituras automáticas de claves, términos o cuentas.

## Lo que sigue sin demostrarse

1. **Excepción exacta del profesor:** todavía no se obtuvo naturalmente en `POST /login/canvas` la firma `ActiveRecord::InvalidForeignKey`, `fk_rails_337ba633a9` y `terms_of_services`.
2. **Multi-shard real:** las dos bases históricas completas solo registran un shard, y no se inventaron IDs de shards ni conexiones SQL para simular Rails.
3. **LTI cruzando Canvas histórico + Plugin Feedback actual:** la existencia de la configuración LTI en la base no equivale a un lanzamiento completo del plugin. Se necesita desplegar el plugin actual mediante su configuración QA y registrar correctamente su URL/cliente en una copia desechable de Canvas.
4. **Actualizar Canvas entre revisiones distintas:** los dos Canvas históricos tienen el mismo commit y 94 migraciones; no existe aún un caso real de upgrade del esquema entre esas dos copias.

Para atribuir el incidente del profesor a una causa real, la evidencia de mayor valor es **su diagnóstico de solo lectura sanitizado**, incluyendo identificación de los shards, relación de términos/cuentas, integridad de la FK y continuidad de las claves de su instalación, sin revelar esas claves. De manera alternativa, se requiere un laboratorio Rails multi-shard válido y un login natural que produzca esa misma excepción.

## Integridad y publicación

Se verificaron los orígenes PostgreSQL detenidos, el árbol Git del repositorio principal y la eliminación de contenedores/volúmenes/networks QA. Todos los cambios de código están exclusivamente en el clon unificado `main`. Los demás clones no recibieron commits, cambios de archivos ni migraciones. **No se realizó push.**
