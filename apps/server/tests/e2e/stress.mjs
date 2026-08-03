import autocannon from 'autocannon';
import pc from 'picocolors';

// ─────────────────────────────────────────────────────────────────────────────
// Pruebas de Estrés y Resiliencia — Alineadas con docs/TESTING_AND_PERFORMANCE.md
//
// Cada escenario se ejecuta en un proceso Node limpio (invocado por testRunner.js)
// para evitar interferencia entre instancias de autocannon y conexiones TLS.
//
// El argumento STRESS_SCENARIO controla qué escenario ejecutar:
//   baseline       → Bombardeo a /health/detailed (línea base de latencia)
//   idempotency    → Misma Idempotency-Key masiva (defensa contra duplicados)
//   ratelimiter    → Keys dinámicas, se espera HTTP 429 (defensa DDoS)
//   circuitbreaker → Rate Limit OFF, satura backend (defensa contra fallas remotas)
// ─────────────────────────────────────────────────────────────────────────────

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const SERVER_PORT = process.env.PORT || 3000;
const PROTOCOL = process.env.HTTPS === 'false' ? 'http' : 'https';
const BASE_URL = `${PROTOCOL}://127.0.0.1:${SERVER_PORT}`;
const SCENARIO = process.env.STRESS_SCENARIO || 'baseline';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Espera a que el servidor esté listo antes de bombardearlo. */
async function waitForServer(maxRetries = 10, delayMs = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(3000) });
      if (res.ok || res.status < 500) return; // servidor vivo
    } catch { /* retry */ }
    await new Promise(r => setTimeout(r, delayMs));
  }
  throw new Error('El servidor no respondió después de múltiples reintentos.');
}

async function getAuthCookie() {
  const loginUrl = `${BASE_URL}/api/auth/local-login`;
  const response = await fetch(loginUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'profesor@canvas.local', password: 'password123' })
  });

  if (!response.ok) {
    throw new Error(`Login local falló: ${response.status} - ${await response.text()}`);
  }

  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) throw new Error('No se recibió la cookie dev-token.');

  return setCookie.split(',').map(c => c.split(';')[0].trim()).join('; ');
}

function printHeader(name, description, connections, duration) {
  console.log(pc.yellow(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));
  console.log(pc.bold(pc.yellow(`  [Escenario] ${name}`)));
  console.log(pc.dim(`  ${description}`));
  console.log(pc.dim(`  Conexiones: ${connections} | Duración: ${duration}s`));
  console.log(pc.yellow(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`));
}

function printResult(result) {
  const totalReqs = result.requests.total;
  const avgLatency = result.latency.average;
  const avgRPS = result.requests.average;
  const p99 = result.latency.p99;
  const non2xx = result.non2xx;
  const errors = result.errors;
  const _2xx = result['2xx'];

  console.log(pc.white(`  ┌──────────────────────────────────────────────────┐`));
  console.log(pc.white(`  │`) + `  Peticiones Totales:  ${pc.cyan(String(totalReqs).padStart(10))}              ` + pc.white(`│`));
  console.log(pc.white(`  │`) + `  Exitosas (2xx):      ${pc.green(String(_2xx).padStart(10))}              ` + pc.white(`│`));
  console.log(pc.white(`  │`) + `  Bloqueadas (non-2xx):${pc.blue(String(non2xx).padStart(10))}              ` + pc.white(`│`));
  console.log(pc.white(`  │`) + `  Throughput:          ${pc.cyan((avgRPS + ' req/s').padStart(10))}              ` + pc.white(`│`));
  console.log(pc.white(`  │`) + `  Latencia Promedio:   ${pc.cyan((avgLatency + ' ms').padStart(10))}              ` + pc.white(`│`));
  console.log(pc.white(`  │`) + `  Latencia P99:        ${pc.cyan((p99 + ' ms').padStart(10))}              ` + pc.white(`│`));
  if (errors > 0) {
    console.log(pc.white(`  │`) + `  Timeout/Error:       ${pc.red(String(errors).padStart(10))}              ` + pc.white(`│`));
  }
  console.log(pc.white(`  └──────────────────────────────────────────────────┘`));

  return { totalReqs, avgLatency, avgRPS, p99, non2xx, errors, _2xx };
}

// ── Escenarios ───────────────────────────────────────────────────────────────

async function scenarioBaseline() {
  printHeader(
    'Baseline de Rendimiento (Health Endpoint)',
    'Medición de latencia cruda y throughput del servidor.\nEstablece la línea base de rendimiento sin lógica de negocio pesada.',
    10, 5
  );

  const result = await autocannon({
    url: `${BASE_URL}/health`,
    method: 'GET',
    connections: 10,
    pipelining: 1,
    duration: 5,
    timeout: 30,
    tlsOptions: { rejectUnauthorized: false }
  });

  const stats = printResult(result);
  const pass = stats.errors === 0 && stats.avgLatency < 200;
  console.log(pass
    ? pc.green(`\n  ✔ PASÓ: Latencia media ${stats.avgLatency}ms < 200ms. ${stats.avgRPS} req/s sostenidos. 0 crashes.`)
    : pc.red(`\n  ✘ FALLÓ: Latencia excesiva (${stats.avgLatency}ms) o errores de conexión (${stats.errors}).`)
  );
  // Salir con código 0 (pass) o 1 (fail)
  process.exit(pass ? 0 : 1);
}

async function scenarioIdempotency(baseHeaders) {
  printHeader(
    'Defensa contra Duplicidad (Idempotency Manager)',
    'Peticiones masivas con la misma Idempotency-Key.\nSolo la primera se procesa; las demás devuelven respuesta cacheada (409/200).\nRef: TESTING_AND_PERFORMANCE.md §2.2.1',
    20, 10
  );

  const result = await autocannon({
    url: `${BASE_URL}/api/feedback/generate-all`,
    method: 'POST',
    body: JSON.stringify({ courseId: '1', activeAssignments: [], students: [] }),
    headers: { ...baseHeaders, 'idempotency-key': 'stress-idempotency-fixed-key' },
    connections: 20,
    pipelining: 1,
    duration: 10,
    timeout: 30,
    tlsOptions: { rejectUnauthorized: false }
  });

  const stats = printResult(result);
  const pass = stats.errors === 0;
  console.log(pass
    ? pc.green(`\n  ✔ PASÓ: ${stats.totalReqs} peticiones procesadas. ${stats.non2xx} duplicadas bloqueadas. 0 crashes.`)
    : pc.red(`\n  ✘ FALLÓ: Se detectaron ${stats.errors} errores de conexión/timeout.`)
  );
  process.exit(pass ? 0 : 1);
}

async function scenarioRateLimiter(baseHeaders) {
  printHeader(
    'Defensa contra DDoS (Global Rate Limiter)',
    'Peticiones con Idempotency-Key dinámica (única por request).\nLas primeras 200 pasan; desde la 201 → HTTP 429 Too Many Requests.\nRef: TESTING_AND_PERFORMANCE.md §2.2.2',
    20, 10
  );

  const result = await autocannon({
    url: `${BASE_URL}/api/feedback/generate-all`,
    method: 'POST',
    body: JSON.stringify({ courseId: '1', activeAssignments: [], students: [] }),
    headers: { ...baseHeaders, 'idempotency-key': 'stress-ratelimit-[<id>]' },
    connections: 20,
    pipelining: 1,
    duration: 10,
    timeout: 30,
    idReplacement: true,
    tlsOptions: { rejectUnauthorized: false }
  });

  const stats = printResult(result);
  // Esperamos muchos non-2xx (429) y 0 errores de conexión
  const pass = stats.non2xx > 0 && stats.errors === 0;
  console.log(pass
    ? pc.green(`\n  ✔ PASÓ: Rate Limiter bloqueó ${stats.non2xx} peticiones correctamente. 0 crashes.`)
    : stats.errors > 0
      ? pc.red(`\n  ✘ FALLÓ: ${stats.errors} errores de conexión/timeout.`)
      : pc.yellow(`\n  ⚠ PARCIAL: non2xx=${stats.non2xx}, errors=${stats.errors}. Verificar si el Rate Limiter está activo.`)
  );
  process.exit(pass ? 0 : 1);
}

async function scenarioCircuitBreaker(baseHeaders) {
  printHeader(
    'Defensa contra Fallas Remotas (Circuit Breaker)',
    'Rate Limit desactivado. Las peticiones saturan el motor de feedback.\nCanvas/LLM fallan → Circuit Breaker se abre → respuesta local rápida sin colapso.\nRef: TESTING_AND_PERFORMANCE.md §2.2.3 & §3',
    20, 10
  );

  const result = await autocannon({
    url: `${BASE_URL}/api/feedback/generate-all`,
    method: 'POST',
    body: JSON.stringify({
      courseId: '1',
      activeAssignments: [{ id: '999', templateId: 1 }],
      students: [{ id: 'stress-student-1' }]
    }),
    headers: { ...baseHeaders, 'idempotency-key': 'stress-circuit-[<id>]' },
    connections: 20,
    pipelining: 1,
    duration: 10,
    timeout: 30,
    idReplacement: true,
    tlsOptions: { rejectUnauthorized: false }
  });

  const stats = printResult(result);
  const pass = stats.errors === 0;
  console.log(pass
    ? pc.green(`\n  ✔ PASÓ: ${stats.totalReqs} peticiones sin caídas. Circuit Breaker protegió el backend.`)
    : pc.red(`\n  ✘ FALLÓ: ${stats.errors} errores de conexión. El servidor pudo haberse caído.`)
  );
  process.exit(pass ? 0 : 1);
}

// ── Punto de Entrada ─────────────────────────────────────────────────────────

async function main() {
  // Para escenarios que requieren autenticación
  let baseHeaders = {};
  // Verificar que el servidor esté vivo y recuperado antes de cada escenario
  await waitForServer();

  if (SCENARIO !== 'baseline') {
    console.log(pc.blue('  [Preparación] Autenticando usuario de prueba...'));
    try {
      const cookieString = await getAuthCookie();
      baseHeaders = {
        'Cookie': cookieString,
        'Content-Type': 'application/json'
      };
      console.log(pc.green('  [✔] Autenticación exitosa.\n'));
    } catch (error) {
      console.error(pc.red(`  [✘] Error de autenticación: ${error.message}`));
      process.exit(1);
    }
  }

  switch (SCENARIO) {
    case 'baseline':       return scenarioBaseline();
    case 'idempotency':    return scenarioIdempotency(baseHeaders);
    case 'ratelimiter':    return scenarioRateLimiter(baseHeaders);
    case 'circuitbreaker': return scenarioCircuitBreaker(baseHeaders);
    default:
      console.error(pc.red(`Escenario desconocido: ${SCENARIO}`));
      process.exit(1);
  }
}

main().catch(err => {
  console.error(pc.red('Error crítico:'), err);
  process.exit(1);
});
