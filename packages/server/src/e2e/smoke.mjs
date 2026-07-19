import https from 'node:https';
import pc from 'picocolors';
import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const pluginDomain = process.env.VITE_LTI_DOMAIN || 'https://localhost:8443';
const canvasUrl = process.env.CANVAS_BASE_URL;
const canvasToken = process.env.CANVAS_ACCESS_TOKEN;

/**
 * Validaciones estáticas de endpoints que no requieren navegador.
 */
async function runSmokeTests() {
  console.log(pc.gray('=============================================='));
  console.log(pc.bold(pc.white('  SMOKE TESTS: Validación de Salud y Endpoints')));
  console.log(pc.gray('==============================================\n'));

  // Permitir certificados autofirmados si estamos probando en localhost
  const agent = new https.Agent({ rejectUnauthorized: !pluginDomain.includes('localhost') });

  // 1. Probar JWKS
  console.log(pc.cyan(`➤ Verificando JWKS Endpoint en ${pluginDomain}...`));
  try {
    const jwksRes = await fetch(`${pluginDomain}/api/lti/jwks`, { agent });
    if (!jwksRes.ok) throw new Error(`HTTP ${jwksRes.status}`);
    const jwks = await jwksRes.json();
    if (!jwks.keys || jwks.keys.length === 0) throw new Error('JWKS no contiene llaves válidas');
    console.log(pc.green('✔ JWKS Endpoint operativo y exponiendo llaves.\n'));
  } catch (err) {
    console.error(pc.red(`❌ Fallo en JWKS: ${err.message}\n`));
  }

  // 2. Probar Login OIDC Initialization URL
  console.log(pc.cyan(`➤ Verificando OIDC Initialization URL...`));
  try {
    const loginRes = await fetch(`${pluginDomain}/api/lti/login`, { agent });
    // Esperamos un error 400 (Faltan parámetros) pero no un 404 o 500
    if (loginRes.status === 404 || loginRes.status >= 500) {
      throw new Error(`Endpoint inalcanzable o roto: HTTP ${loginRes.status}`);
    }
    console.log(pc.green(`✔ OIDC Initiation Endpoint responde (HTTP ${loginRes.status} esperado al consultar sin OIDC params).\n`));
  } catch (err) {
    console.error(pc.red(`❌ Fallo en OIDC Login: ${err.message}\n`));
  }

  // 3. Probar API de Canvas (Si existe Token)
  if (canvasUrl && canvasToken) {
    console.log(pc.cyan(`➤ Verificando Canvas API Token contra ${canvasUrl}...`));
    try {
      const apiRes = await fetch(`${canvasUrl.replace(/\/$/, '')}/api/v1/users/self`, {
        headers: {
          'Authorization': `Bearer ${canvasToken}`,
          'Accept': 'application/json'
        }
      });
      if (!apiRes.ok) throw new Error(`Token inválido o expirado (HTTP ${apiRes.status})`);
      const user = await apiRes.json();
      console.log(pc.green(`✔ Token válido. Conectado como ID de usuario: ${user.id} (${user.name})\n`));
    } catch (err) {
      console.error(pc.red(`❌ Fallo en API Canvas: ${err.message}\n`));
    }
  } else {
    console.log(pc.yellow('⚠ Saltando test de Canvas API: No hay CANVAS_BASE_URL o CANVAS_ACCESS_TOKEN en el .env\n'));
  }

  console.log(pc.bold(pc.white('Smoke Tests finalizados.\n')));
}

runSmokeTests();
