import http from 'node:http';
import jwt from 'jsonwebtoken';
import { generateKeyPairSync } from 'node:crypto';

const API_URL = 'http://localhost:3000/api/courses';

const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m"
};

function log(testName, status, details) {
  const color = status === 'PASSED' ? colors.green : status === 'FAILED' ? colors.red : colors.yellow;
  console.log(`${color}[${status}] ${testName}${colors.reset}`);
  if (details) {
    console.log(`  └─ ${details}`);
  }
}

async function makeRequest(headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get(API_URL, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : null;
          resolve({ status: res.statusCode, data: json });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function generateFakeToken(sub) {
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicExponent: 0x10001,
  });
  const privateKeyPem = privateKey.export({ format: 'pem', type: 'pkcs1' });
  
  const payload = {
    sub: sub || 'fake-sub-1234',
    iss: 'plugin-session',
    aud: 'plugin',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  return jwt.sign(payload, privateKeyPem, { algorithm: 'RS256' });
}

async function runDiagnostics() {
  console.log(`${colors.cyan}\n=== Iniciando Test de Caja Negra Diagnóstico (Auth LTI) ===${colors.reset}\n`);

  // Test 1: Petición sin cookie de sesión
  try {
    const res = await makeRequest();
    if (res.status === 401 && res.data?.error?.mensaje === 'Sesión no válida o expirada') {
      log('Test 1: Petición sin cookie', 'PASSED', 'Devuelve 401 puro (Esperado)');
    } else {
      log('Test 1: Petición sin cookie', 'FAILED', `Status inesperado: ${res.status}. Body: ${JSON.stringify(res.data)}`);
    }
  } catch (e) {
    log('Test 1: Petición sin cookie', 'ERROR', e.message);
  }

  // Test 2: Petición con firma inválida (Clave RSA aleatoria)
  try {
    const fakeToken = generateFakeToken();
    const res = await makeRequest({ Cookie: `session_token=${fakeToken}` });
    // Middleware de sesión captura el invalid signature y tira 401
    if (res.status === 401 && res.data?.error?.mensaje === 'Sesión no válida o expirada') {
      log('Test 2: Petición con firma inválida', 'PASSED', 'Devuelve 401 puro por invalid signature (Esperado)');
    } else {
      log('Test 2: Petición con firma inválida', 'FAILED', `Status inesperado: ${res.status}. Body: ${JSON.stringify(res.data)}`);
    }
  } catch (e) {
    log('Test 2: Petición con firma inválida', 'ERROR', e.message);
  }

  // Test 3: Simular UUID inexistente en base de datos
  // Para hacer esto necesitamos la llave real del servidor. Como es caja negra, si tuviéramos un token firmado 
  // real con un sub inventado, debería darnos requireOAuth: true.
  console.log(`\n${colors.yellow}Nota: Test 3 y 4 requieren inyectar un token válido firmado por el servidor para simular sub-inexistente y state mismatch, lo cual no es posible externamente sin capturar primero el session_token real tras un login exitoso.${colors.reset}`);
  console.log(`${colors.cyan}\n=== Diagnóstico Completado ===${colors.reset}\n`);
}

runDiagnostics();
