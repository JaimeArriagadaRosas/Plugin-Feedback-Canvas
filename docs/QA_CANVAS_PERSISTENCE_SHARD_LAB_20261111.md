# Laboratorio causal de Canvas: persistencia, instalaciones anteriores y shards

**Fecha:** 11 de noviembre de 2026. **Estado:** implementación y pruebas de laboratorio completadas; causa original aún desconocida.

## Objetivo

Investigar el error observado por el profesor:

```text
ActiveRecord::InvalidForeignKey in Login::CanvasController#create
PG::ForeignKeyViolation en terms_of_services
account_id 100000000000001 no se encuentra en accounts
```

Separar cuidadosamente tres pruebas que NO son equivalentes:

1. PostgreSQL puede reproducir una infracción de clave foránea.
2. Rails puede recibir/resolver una referencia global o shard.
3. Un inicio de sesión ordinario provoca espontáneamente ese error.

Solo las dos primeras tienen evidencia positiva o negativa en este laboratorio. **La tercera no está demostrada.**

## Resultados de la ejecución

### A. Copia real de tablas relevantes: 9/9 experimentos

`tools/diagnostics/qa_canvas_history_lab.py` verifica las etiquetas de un PostgreSQL de QA, obtiene de `canvas_development` una copia de las tablas `accounts`, `terms_of_services` y `switchman_shards` con sus registros e índices necesarios, conserva la **FK real de términos**, crea una base de nombre UUID y ejecuta escenarios independientes mediante `BEGIN ... ROLLBACK`.

| Escenario | Resultado controlado | Qué significa |
|---|---|---|
| Cuenta raíz actual | Existe | Control positivo |
| Términos anteriores ausentes | Su ausencia se observa dentro de una transacción | Posible dato previo; no equivale a fallo |
| Referencia global antigua en términos | Rechazada por la FK observada | Coincide con la restricción del profesor |
| Referencia local inexistente | Rechazada por la misma FK | No se requiere un problema de shards para obtener esa FK |
| Términos duplicados | Se rechazan por unicidad | Otro error distinto |
| `search_path` incorrecto | Relación inexistente | Otro error distinto |
| Cuenta secundaria referenciada | SQL la acepta | La validación de cuenta raíz pertenece a Rails |
| Shard inexistente | No se encuentra | Control negativo |
| ID global consultado como local | No se encuentra | No prueba que esté mal en otro shard |

Resultados: **9/9**. La huella limitada a IDs, asociación cuenta raíz y términos fue idéntica antes y después. La base temporal se **eliminó** y la base QA de origen permaneció intacta.

Una primera tentativa de restaurar **toda** la base de 327 tablas excedió el tiempo de ejecución. Se canceló y eliminó expresamente esa copia parcial antes de usar el método selectivo. **No hubo resultado causal de ese intento.** El método aprobado no restaura un Canvas completo: restaura solo tres tablas y NO pretende probar un login Rails.

### B. Rastreo real mediante modelos Rails

`qa_canvas_shard_trace.py` solo admite el contenedor `web` de QA cuyo proyecto y directorio Compose coinciden exactamente. Ejecuta `rails runner` con consultas a `Account`, `TermsOfService` y `Shard`, **sin llamar a métodos que creen registros**.

Hallazgos del laboratorio: **1 shard**, **5 cuentas**, **3 términos**, cuenta raíz y términos por defecto existentes, shard activo igual al predeterminado. `Shard.local_id_for(100000000000001)` no resolvió un shard registrado y ese ID no existe como cuenta local. No permite inferir el entorno del profesor, que no hemos inspeccionado.

### C. Persistencia y metadatos históricos: 7/7 clasificadores

`qa_canvas_persistence_matrix.py` compara etiquetas Compose, directorio propietario, imagen, puertos y hashes de identidad de volúmenes. No lee valores de `.env`: solo compara **nombres de claves**.

Hallazgo real: en el proyecto histórico `canvas-lms-master` existen **dos contenedores PostgreSQL detenidos** con las mismas etiquetas de proyecto/servicio; no es seguro escoger uno automáticamente. Mensaje `CANVAS-DOCKER-LEGACY-001`. También se encontraron diferencias en las claves de configuración de los proyectos: la instalación QA tiene claves explícitas de aislamiento de contenedores y puerto Gotenberg que faltan en el entorno anterior.

Los siete escenarios de **clasificación sintética** detectaron apropiadamente proyecto cambiado, directorio obsoleto, imagen diferente, volumen, puerto, servicio y control sin diferencias. Estos son ensayos del detector, **no siete incidentes reales**.

### D. Controlador integral

`qa_canvas_investigate.py` ejecuta las tres etapas secuencialmente y combina las evidencias en un informe. Es de **ejecución única**: no instala servicios, tareas periódicas ni observadores permanentes. Puede añadir Playwright headless únicamente con `--with-headless`, cuentas sintéticas configuradas y puerto HTTPS confirmado como propiedad del preboot aislado de QA.

Ejemplo:

```bash
cd ~/proyectos/Plugin-Feedback-Canvas-repro-fk-20261110
QA_ALLOW_CANVAS_CAUSAL_LAB=true \
  python3 tools/diagnostics/qa_canvas_investigate.py
```

El laboratorio deja sus informes en `/home/jaime/qa-feedback-20261110/artifacts/` (fuera del repositorio). Ninguna contraseña, token o contenido de logs Rails se registra allí. El wrapper establece los permisos de ejecución únicamente para sus tres componentes QA; éstos vuelven a verificar contenedores y proyecto antes de operar.

Pruebas específicas:

```bash
python3 -m unittest discover \
  -s tools/diagnostics/tests -p 'test_qa_*.py' -v
```

## Política de recuperación y límites

- Una diferencia de proyecto/imagen/volumen **bloquea la selección automática**; no limpia ni arranca instalaciones anteriores.
- `CANVAS-DOCKER-LEGACY-001` avisa de un estado histórico ambiguo, **sin afirmar que haya causado el error del profesor**.
- Las recuperaciones previamente aprobadas de servicios propios pueden operar exclusivamente con autorización explícita y etiquetas verificadas; este laboratorio **no ejecuta** esas recuperaciones.
- No crear automáticamente cuentas, cambiar `account_id`, insertar términos ni modificar `switchman_shards`. Primero debe reproducirse una causa real y definirse una reparación reversible.
- Este laboratorio tiene **un solo shard real**. Los escenarios SQL y las diferencias de metadatos no sustituyen un laboratorio multi-shard compatible con Canvas ni un diagnóstico autorizado de la instalación afectada.
- Para contrastar el caso del profesor, utilizar el diagnóstico de solo lectura de la **opción 6 de Validaciones de Caja Negra** y cotejar sus resultados con los informes aquí generados. Los cambios de esa opción están en el repositorio `Plugin-Feedback-Canvas-feedback-cualitativo` y se versionaron por separado.

**Criterio de salida pendiente:** conseguir una secuencia de autenticación real que provoque el mismo error **sin inyección artificial**, o disponer de una traza autorizada de la instalación afectada que demuestre cuál referencia o configuración lo desencadena.

## Integridad de los proyectos

Los datos de la instalación histórica, su repositorio y sus volúmenes **no fueron alterados**. El laboratorio solo realiza operaciones en QA y en bases temporales con nombres aleatorios, eliminadas después de cada ejecución. Los informes del laboratorio son evidencias técnicas, no reparaciones.

## Comprobaciones de cierre

- Suite integrada de tres etapas: **3/3 aprobadas**.
- Pruebas SQL con copia real y rollback: **9/9 aprobadas**.
- Clasificación de cambios de configuración: **7/7 aprobadas**.
- Rails runner: completado, sin escrituras.
- Inicio de sesión real adicional por Chromium headless directamente contra Canvas QA (sin iniciar otra vez la aplicación): administrador con cuatro recargas y profesor con cookie de autenticación inválida + nuevo login, **2/2 aprobados**, sin FK espontánea.
- Regresión JavaScript: **374 aprobadas, 21 omitidas y cero fallidas**; lint y build correctos.
- Pruebas unitarias Python de guardas QA, rollback y clasificación: ver salida de `unittest`.
- Cierre del laboratorio: **cero bases temporales** `qa_canvas_history_*` persistentes.

Los informes y logs de todas estas ejecuciones están en `/home/jaime/qa-feedback-20261110/artifacts/` y `/home/jaime/qa-feedback-20261110/logs/`.

No se ejecutó ninguna recuperación de datos de Canvas. El comportamiento conservador ante configuraciones antiguas ambiguas es la protección implementada; la reparación específica continúa bloqueada por falta de una causa confirmada.
