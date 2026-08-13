# Registro de deuda técnica

Este registro separa funcionalidades implementadas de preparación operativa. Las prioridades son: **P0** bloquea producción, **P1** debe cerrarse antes de ampliar un piloto y **P2** mejora mantenibilidad/experiencia.

## Resumen

| ID | Prioridad | Estado | Tema |
|---|---:|---|---|
| TD-01 | P0 | abierto | certificación LTI institucional |
| TD-02 | P0 | abierto | jobs masivos no durables |
| TD-03 | P0 | abierto | correo productivo ausente |
| TD-04 | P0 | abierto | rotación de claves históricas |
| TD-05 | P1 | abierto | E2E débiles/incompletos |
| TD-06 | P1 | abierto | RF06 escribe código al filesystem |
| TD-07 | P1 | parcial | matriz multiplataforma final |
| TD-08 | P1 | abierto | despliegue/operación productiva |
| TD-09 | P2 | abierto | variables SIS simuladas |
| TD-10 | P2 | abierto | exigencia de calificación fija |
| TD-11 | P2 | abierto | formato enriquecido limitado |
| TD-12 | P2 | abierto | rendimiento del frontend |
| TD-13 | P2 | abierto | scripts heredados y límites SOLID |
| TD-14 | P2 | abierto | diseño de notificaciones |

## TD-01 — Certificación LTI institucional

**Problema:** modos 1/2 y la configuración LTI no se han probado de extremo a extremo contra un Canvas institucional/staging con Developer Key, deployments, scopes y roles reales de prueba.

**Riesgo:** fallos OIDC/JWKS, cookies iframe, scopes, account/subaccount, identidad o endpoints al desplegar.

**Cierre:** E2E por rol en staging, pruebas negativas de issuer/audience/nonce/deployment, revisión administrativa del placement y rollback documentado.

## TD-02 — Jobs masivos no durables

**Problema:** `MassiveGenerationOrchestrator` usa `setTimeout(..., 0)` y bucles dentro del proceso Node.

**Riesgo:** reiniciar/crashear pierde trabajo; no hay lease, reanudación, estado durable, coordinación de réplicas ni dead-letter.

**Cierre:** cola durable con idempotencia, estados por estudiante/tarea, retries con backoff, cancelación, observabilidad y recuperación demostrada tras reinicio.

## TD-03 — Correo productivo

**Problema:** `EmailService.local.js` escribe `local-emails.log`; no existe adaptador SMTP/API institucional.

**Riesgo:** RF42/RF44 y preferencias de correo no funcionan realmente en producción.

**Cierre:** proveedor aprobado, plantillas, secretos, idempotencia/retries, métricas de entrega y prueba masiva con cuentas de staging.

## TD-04 — Claves históricas

**Problema:** la línea base de Gitleaks contiene dos claves privadas antiguas presentes en commits públicos.

**Riesgo:** cualquier sistema que aún confíe en ellas puede quedar comprometido.

**Cierre:** inventario, revocación/rotación confirmada y decisión coordinada sobre reescritura de historial. Ignorar fingerprints no cierra el riesgo.

## TD-05 — Cobertura E2E

**Problema:** `login.spec.js` y `massive-feedback.spec.js` terminan con asserts triviales; el segundo captura errores de título. El LTI local omite iframe si no ve el enlace.

**Riesgo:** CI verde sin probar acciones críticas ni integración real.

**Cierre:** selectores estables, aserciones de estado/Canvas/BD, escenarios individuales y masivos, y una suite staging obligatoria antes de release.

## TD-06 — Variables dinámicas RF06

**Problema:** crear una variable genera JavaScript bajo `services/variables` y modifica un registro en memoria.

**Riesgo:** filesystem mutable, divergencia entre réplicas, pérdida en redeploy, auditoría/rollback débiles y superficie de generación de código.

**Cierre:** catálogo versionado de resolvers + configuración persistida/declarativa. Véase [VARIABLES.md](VARIABLES.md).

## TD-07 — Matriz multiplataforma

**Avance:** setup completo validado en Ubuntu/WSL2 rootless; adaptadores Linux/Windows separados y tests unitarios disponibles.

**Pendiente:** ejecución limpia en VM/host Linux independiente, otro Windows, macOS y estrategias DNF/Pacman. Registrar permisos, tiempos, disco, reinicio y limpieza.

## TD-08 — Operación productiva

**Problema:** los compose y modo 1 son referencias, no una plataforma certificada.

**Pendiente:** TLS/ingress, imágenes inmutables, secretos, health/readiness, observabilidad, backups, restore, migración, HA, límites, runbooks, rollback y prueba de carga reproducible.

## TD-09 — Variables institucionales simuladas

`OtherCoursePerformanceResolver`, `StudentEntryProfileResolver` y `PreviousAcademicStatusResolver` usan datos locales/simulados hasta contar con APIs SIS aprobadas.

**Cierre:** contratos, privacidad, timeouts, cache, fallback y pruebas con staging institucional.

## TD-10 — Exigencia de calificación fija

Algunos cálculos asumen una escala chilena con 60% de exigencia.

**Cierre:** configuración por institución/curso/tarea, persistencia, validación y regresiones para varias escalas.

## TD-11 — Texto enriquecido de Canvas

Los comentarios Canvas no aceptan el HTML/Markdown requerido; `RichTextProcessor` usa caracteres Unicode para simular formato.

**Riesgo:** accesibilidad, búsqueda, copy/paste y renderizado dependiente de fuente.

**Cierre:** validar una vía oficial Canvas compatible o documentar formalmente la degradación a texto plano/accesible.

## TD-12 — Rendimiento frontend

El build advierte chunks grandes asociados a `exceljs` y visor PDF. No hay baseline reproducible de carga/transferencia.

**Cierre:** medir bundle y navegación, lazy-load por ruta/capacidad, presupuesto de rendimiento y regresión automatizada.

## TD-13 — Scripts y SOLID

Persisten scripts sueltos de reparación/diagnóstico y módulos heredados con nomenclatura/responsabilidad desigual.

**Cierre:** inventariar consumidores, mover lógica reutilizable a `apps/server/src`, dejar entrypoints finos y retirar scripts sin flujo soportado. Mantener 300 líneas/archivo y 100/función salvo excepción documentada.

## TD-14 — Diseño de notificaciones

Toasts, banners, avisos persistentes y notificaciones no comparten todavía un sistema visual/semántico completo.

**Cierre:** estados, accesibilidad, severidades y componentes comunes; pruebas visuales y de lector de pantalla.

## Reglas de mantenimiento

- Toda deuda nueva incluye evidencia, riesgo, prioridad y criterio verificable de cierre.
- «Hay código» no equivale a «funciona en producción».
- Al cerrar una deuda, enlace pruebas/commit/artefacto y actualice [README](README.md), [TESTING](TESTING.md) o [DEPLOYMENT](DEPLOYMENT.md) según corresponda.
- No se guardan secretos ni informes privados en este documento.
