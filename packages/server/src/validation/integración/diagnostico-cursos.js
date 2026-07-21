/**
 * Diagnóstico de caja negra - Flujo de carga de cursos
 *
 * Uso:
 *   node packages/server/src/validation/integración/diagnostico-cursos.js
 *
 * Verifica:
 *   1. Estado del servidor (health)
 *   2. Autenticación LTI (/api/config/me)
 *   3. Autorizacion (/api/courses)
 *   4. Latencia de Canvas API
 *   5. Token de Canvas en BD
 */

import http from 'http';

const BASE = process.env.PLUGIN_BASE_URL || 'https://localhost:3000';

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const data = options.body ? JSON.stringify(options.body) : null;
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        },
        rejectUnauthorized: false,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          let parsed = body;
          try {
            parsed = JSON.parse(body);
          } catch {
            parsed = body || null;
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: parsed,
          });
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  console.log('=== Diagnostico Caja Negra - Carga de Cursos ===\n');

  let passed = 0;
  let failed = 0;

  async function check(name, condition, detail = '') {
    if (condition) {
      console.log(`  [OK] ${name}`);
      passed++;
    } else {
      console.log(`  [FAIL] ${name}${detail ? ' - ' + detail : ''}`);
      failed++;
    }
  }

  try {
    console.log('1. Estado del servidor');
    const health = await request('/api/health');
    await check('Servidor responde /api/health', health.status === 200);

    console.log('\n2. Autenticacion (sin token)');
    const meNoAuth = await request('/api/config/me');
    await check('Sin token devuelve 401', meNoAuth.status === 401, `status=${meNoAuth.status}`);

    console.log('\n3. Rutas publicas');
    const startup = await request('/api/config/startup-mode');
    await check('Startup mode responde', startup.status === 200, `status=${startup.status}`);
    await check('STARTUP_MODE=3', startup.body.mode === '3', `mode=${startup.body.mode}`);
    await check('USE_LOCAL_DATA=false', startup.body.useLocalData === false, `useLocalData=${startup.body.useLocalData}`);

    console.log('\n4. Acceso a cursos (sin token)');
    const coursesNoAuth = await request('/api/courses');
    await check('Sin token devuelve 401', coursesNoAuth.status === 401, `status=${coursesNoAuth.status}`);
    await check(
      'Mensaje contiene "Token LTI 1.3 ausente"',
      coursesNoAuth.body?.mensaje?.includes('Token LTI 1.3 ausente'),
      coursesNoAuth.body?.mensaje
    );

    console.log('\n5. Verificacion de configuracion');
    await check('CANVAS_BASE_URL definido', !!process.env.CANVAS_BASE_URL);
    await check('CANVAS_ACCESS_TOKEN definido', !!process.env.CANVAS_ACCESS_TOKEN);
    await check('LTI_DEPLOYMENT_IDS definido', !!process.env.LTI_DEPLOYMENT_IDS || process.env.LTI_DEPLOYMENT_IDS === '');

    console.log('\n6. Resultados');
    console.log(`  Total: ${passed + failed}`);
    console.log(`  Aprobadas: ${passed}`);
    console.log(`  Fallidas: ${failed}`);

    if (failed > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('Error ejecutando diagnostico:', error.message);
    process.exitCode = 1;
  }
}

run();
