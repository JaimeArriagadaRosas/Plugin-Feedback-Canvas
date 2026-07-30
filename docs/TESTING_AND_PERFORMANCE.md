# Estrategia de Testing y Análisis de Rendimiento

Este documento describe la arquitectura de pruebas, los reportes de rendimiento y los mecanismos de resiliencia implementados en el Plugin de Feedback Adaptativo para Canvas LMS. La finalidad es contar con un registro auditable del comportamiento del software bajo condiciones de estrés severas y detallar las defensas de red de la aplicación.

## 1. Arquitectura de Testing
El ecosistema de pruebas de la aplicación está diseñado para proveer seguridad y confianza durante el ciclo de CI/CD:

- **Infraestructura de Bases de Datos:** Se utiliza **Testcontainers (PostgreSQL)** para inicializar bases de datos efímeras en entornos aislados. Esto asegura que los tests de integración y estrés no contaminen bases de datos de desarrollo o producción.
- **Pruebas de Estrés y Carga:** Utilización de **Autocannon** para bombear miles de solicitudes concurrentes y medir la latencia, el throughput, y el manejo del connection pool del ORM.
- **Pruebas End-to-End (Fase de Implementación):** Playwright será integrado para validar flujos de usuario crítico sin comprometer las API de OpenAI o Canvas (usando *Mock Service Worker* y *Fixtures* temporales).

---

## 2. Reporte de Pruebas de Estrés y Resiliencia (Capa de Red)

### 2.1 Metodología
Se expuso el endpoint crítico `/api/feedback/generate-all` (Responsable de la generación masiva asíncrona) a un volumen simulado extremo.
- **Peticiones:** > 15,000 requests.
- **Ventana de tiempo:** 10 segundos.
- **Concurrencia:** 50 clientes paralelos saturando el hilo de Node.js y la cola de Express.

### 2.2 Estados de Error Identificados
Durante la prueba de estrés, el servidor demostró que cuenta con mecanismos de defensa profundos ("Defense in Depth") que evitan que un ataque o carga inesperada impacten en el núcleo de la base de datos o agoten recursos críticos:

1. **Defensa contra Duplicidad (Idempotency Manager):**
   - **Comportamiento:** Peticiones masivas con el mismo payload fueron bloqueadas inmediatamente con un código `400 Bad Request` si carecían del `Idempotency-Key`, o se devolvía el resultado cacheado del primer requerimiento válido.
   - **Impacto:** Evita corromper la base de datos con inserciones duplicadas (Ej. Profesores haciendo doble clic).

2. **Defensa contra DDoS (Global Rate Limiter):**
   - **Comportamiento:** Al inyectar llaves de idempotencia dinámicas, las primeras 200 peticiones en 15 minutos fueron procesadas. La petición 201 en adelante fue bloqueada en capa 7 (Express) devolviendo `429 Too Many Requests`.
   - **Impacto:** Detiene scripts automatizados y picos de red anómalos.

3. **Defensa contra Fallas Remotas (Circuit Breaker):**
   - **Comportamiento:** Al omitir el Rate Limit (para probar carga bruta), el motor de Feedback intentó conectarse a la API de Canvas. Debido a errores recurrentes (fallos de conexión / tokens inválidos o de test), el Circuit Breaker registró los fallos rápidos. Al tercer error consecutivo, el circuito se "Abrió" (Open State).
   - **Impacto:** Las subsecuentes >14,000 llamadas fallaron localmente con un `503/500 Canvas API temporalmente no disponible (circuito abierto)` en lugar de intentar la petición remota (lo cual habría colgado al servidor con bloqueos I/O y timeouts).

### 2.3 Conclusiones de la Capa de Red
El backend **no experimentó caídas (0 Crashes), fugas de memoria o bloqueos** (la latencia media se mantuvo en `~32 ms` y el throughput sostenido fue superior a `1500 RPS`). Los tres anillos concéntricos de defensa actuaron de manera anticipada protegiendo a la Base de Datos subyacente.

---

## 3. Pruebas de Estrés Profundo (Database / LLM Load)

### 3.1 Metodología (Fase 1)
Para validar la estabilidad del motor de base de datos bajo alta concurrencia sin que el Rate Limit de APIs de terceros (Canvas, OpenAI) interfiera, se ejecutó una prueba de estrés profundo aislando la red.
- **Mocks inyectados:** `CanvasLmsAdapterLocal` y `GeminiProvider`.
- **Entorno de BD:** PostgreSQL aprovisionado efímeramente vía *Testcontainers*.
- **Volumen inyectado:** +3,200 peticiones en 10 segundos, disparando promesas asíncronas de inserción en la BD.

### 3.2 Resultados y Rendimiento de BD
La prueba de estrés profundo se ejecutó con éxito superando la barrera del Circuit Breaker:
- **Latencia Media:** `150.74 ms` (aumento esperado al ejecutar miles de promesas concurrentes).
- **Throughput:** `329.1 RPS` promedio, saturando intencionalmente la cola de procesos de Node.js.
- **Errores HTTP 5xx/Timeouts:** `0`
- **Comportamiento del Connection Pool:** PostgreSQL y `pg` gestionaron exitosamente la lluvia de sentencias `INSERT` mediante el pooler por defecto, demostrando que la base de datos no es el cuello de botella.
- **Defecto Encontrado (y Corregido):** Durante la prueba masiva, descubrimos que el esquema de base de datos en código (migraciones faltantes) tenía una desalineación con la tabla `historial_feedback_generado` (faltaba la columna `profesor_id`), lo cual causaba rechazos silenciosos. Fue detectado por la sobrecarga y corregido mediante la migración `017_add_profesor_id_to_feedback.sql`.

---

## 4. Pruebas End-to-End Visuales (Caja Negra)

### 4.1 Estrategia de Testing en Interfaz (Fase 2)
Para garantizar la estabilidad del Frontend sin ensuciar los entornos de producción ni requerir bases de datos pesadas en los pipelines de UI, se ha implementado una arquitectura de pruebas **no destructivas** mediante Playwright.

- **Herramienta:** Playwright (con soporte cross-browser).
- **Enfoque de Caja Negra Aislada:** Las pruebas simulan interacciones reales del usuario en el navegador (ej: hacer clic en "Generar Feedback Masivo"), pero las peticiones al backend son interceptadas en la capa de red del navegador mediante `page.route()`.
- **Mocks Dinámicos:** En lugar de levantar `Testcontainers` o MSW para los tests puramente visuales, Playwright inyecta respuestas JSON simuladas (ej: devolviendo `202 Accepted` al disparar el proceso masivo, o devolviendo perfiles de profesor falsos para `/api/session/status`). Esto previene el uso de dependencias externas.

### 4.2 Ejecución
Los scripts de E2E residen en `apps/client/tests/e2e/`. Por ejemplo, `massive-feedback.spec.js` valida que el dashboard no arroje errores inesperados cuando un profesor selecciona múltiples alumnos e inicia el proceso.

Para ejecutarlos:
```bash
# Desde la raíz del proyecto
npm run test:e2e
```
Playwright puede ser configurado en su archivo base (`playwright.config.js`) para lanzar el `Vite Dev Server` automáticamente antes de correr las pruebas.
