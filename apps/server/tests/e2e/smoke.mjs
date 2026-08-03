import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..', '..', '..');

console.log(pc.blue('--- Iniciando Verificación Smoke (Salud de la API y JWKS) ---'));

// 1. Verificación básica del archivo .env
const envPath = path.join(rootDir, '.env');
if (!fs.existsSync(envPath)) {
  console.error(pc.red('[X] Archivo .env no encontrado. El test no puede continuar.'));
  process.exit(1);
}
console.log(pc.green('[√] Archivo .env detectado.'));

// Deshabilitar validación estricta de SSL local (mkcert)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// 2. Intentar hacer ping al health check del servidor local
const SERVER_PORT = process.env.PORT || 3000;
const PROTOCOL = process.env.HTTPS === 'false' ? 'http' : 'https';
const HEALTH_URL = `${PROTOCOL}://127.0.0.1:${SERVER_PORT}/health/detailed`;
const JWKS_URL = `${PROTOCOL}://127.0.0.1:${SERVER_PORT}/api/lti/jwks`;

async function runSmokeTests() {
  try {
    console.log(pc.dim(`\n  · Probando conexión al servidor en ${HEALTH_URL}...`));
    
    // Bucle de reintentos inteligentes para esperar que el servidor termine de bindear el puerto
    let healthRes;
    let retries = 10;
    while (retries > 0) {
      try {
        healthRes = await fetch(HEALTH_URL);
        if (healthRes.ok) break;
      } catch (err) {
        if (retries === 1) throw err;
      }
      retries--;
      await new Promise(r => setTimeout(r, 1000));
    }

    if (!healthRes || !healthRes.ok) {
      throw new Error(`Health check devolvió status ${healthRes?.status || 'desconocido'}`);
    }
    const healthData = await healthRes.json();
    
    console.log(pc.dim(`  · Probando endpoint JWKS en ${JWKS_URL}...`));
    const jwksRes = await fetch(JWKS_URL);
    if (!jwksRes.ok) {
      throw new Error(`JWKS endpoint devolvió status ${jwksRes.status}`);
    }
    const jwksData = await jwksRes.json();
    if (!jwksData.keys || jwksData.keys.length === 0) {
      throw new Error('JWKS endpoint no retornó claves públicas.');
    }
    
    // Generación del Reporte Visual
    console.log(pc.cyan('\n╔═════════════════════════════════════════════════════════════╗'));
    console.log(pc.cyan('║') + pc.bold(pc.white('  REPORTE DE DIAGNÓSTICO DEL SERVIDOR (LOCAL MOCK)'.padEnd(61))) + pc.cyan('║'));
    console.log(pc.cyan('╠═════════════════════════════════════════════════════════════╣'));

    // Helper para padEnd ignorando caracteres ANSI (los colores rompen el length de JS)
    const pad = (textStr, icon, msg) => {
      const visibleLen = (textStr.length - 4) + 1 + msg.length; // -4 por la palabra 'ICON', +1 por el check ✔/✘
      const spaces = ' '.repeat(Math.max(0, 61 - visibleLen));
      return `${textStr.replace('ICON', icon)}${msg}${spaces}`;
    };

    // DB
    const dbOk = healthData.checks?.db?.status === 'ok';
    const dbIcon = dbOk ? pc.green('✔') : pc.red('✘');
    const dbMsg = dbOk ? 'OK (Mock Data Operativa)' : 'FALLA (Revisar logs de servidor)';
    console.log(pc.cyan('║') + pad('  ICON Base de Datos : ', dbIcon, dbMsg) + pc.cyan('║'));

    // Canvas Circuit
    const canvasOk = healthData.checks?.canvas?.status === 'ok';
    const canvasState = healthData.checks?.canvas?.circuitState || 'UNKNOWN';
    const canvasIcon = canvasOk ? pc.green('✔') : (canvasState === 'OPEN' ? pc.red('✘') : pc.yellow('⚠'));
    const canvasMsg = canvasOk ? `ESTABLE (Circuit Breaker: ${canvasState})` : `INESTABLE (${canvasState})`;
    console.log(pc.cyan('║') + pad('  ICON LTI Adapter   : ', canvasIcon, canvasMsg) + pc.cyan('║'));

    // Webhooks
    const whOk = healthData.checks?.webhooks?.status === 'ok';
    const dlq = healthData.checks?.webhooks?.deadLetterCount || 0;
    const whIcon = whOk ? pc.green('✔') : pc.red('✘');
    const whMsg = whOk ? `SALUDABLE (${dlq} mensajes atascados)` : 'FALLA EN COLAS';
    console.log(pc.cyan('║') + pad('  ICON Webhooks      : ', whIcon, whMsg) + pc.cyan('║'));

    // JWKS
    const jwksOk = healthData.checks?.jwks?.status === 'ok';
    const kid = healthData.checks?.jwks?.kid || 'none';
    const exposedKid = jwksData.keys[0]?.kid;
    const cryptOk = jwksOk && (kid === exposedKid);
    const cryptIcon = cryptOk ? pc.green('✔') : pc.red('✘');
    const cryptMsg = cryptOk ? 'VERIFICADA (KID coincidido)' : 'DESINCRONIZADA';
    console.log(pc.cyan('║') + pad('  ICON Criptografía  : ', cryptIcon, cryptMsg) + pc.cyan('║'));

    console.log(pc.cyan('╠═════════════════════════════════════════════════════════════╣'));
    
    const allPassed = dbOk && canvasOk && whOk && cryptOk;
    if (allPassed) {
      console.log(pc.cyan('║') + pc.bold(pc.green(' RESULTADO: INFRAESTRUCTURA LTI LOCAL 100% LISTA ✔'.padEnd(61))) + pc.cyan('║'));
    } else {
      console.log(pc.cyan('║') + pc.bold(pc.red(' RESULTADO: EXISTEN PROBLEMAS EN LA INFRAESTRUCTURA ✘'.padEnd(61))) + pc.cyan('║'));
    }
    console.log(pc.cyan('╚═════════════════════════════════════════════════════════════╝\n'));
    
    // Esperar 500ms para permitir que los sockets de red se drenen y evitar crash UV_HANDLE_CLOSING en Windows
    setTimeout(() => {
      process.exit(0);
    }, 500);

  } catch (error) {
    console.error(pc.red('\n[X] Error crítico durante la ejecución de los Smoke Tests:'));
    console.error(pc.yellow(`    ${error.message}`));
    console.error(pc.dim('\nAsegúrate de que el servidor esté corriendo antes de lanzar los smoke tests.'));
    process.exit(1);
  }
}

runSmokeTests();
