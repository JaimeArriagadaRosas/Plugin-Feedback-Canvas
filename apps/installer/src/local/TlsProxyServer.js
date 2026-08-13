import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { URL } from 'node:url';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const pluginDirectory = path.resolve(moduleDirectory, '..', '..', '..', '..');
const certificatesDirectory = path.join(pluginDirectory, 'apps', 'server', 'certs');
const tlsListenPort = Number.parseInt(process.env.TLS_LISTEN_PORT || '8443', 10);
const canvasHttpHost = process.env.CANVAS_HTTP_HOST || '127.0.0.1';
const canvasHttpPort = Number.parseInt(process.env.CANVAS_HTTP_PORT || '8080', 10);
const certificatePath = path.join(certificatesDirectory, 'localhost.pem');
const keyPath = path.join(certificatesDirectory, 'localhost-key.pem');

let serverInstance = null;
let proxyInstance = null;

function createCanvasProxy() {
  return http.createServer((request, response) => {
    const target = new URL(request.url, `http://${canvasHttpHost}:${canvasHttpPort}`);
    const proxyRequest = http.request({
      host: target.hostname,
      port: target.port,
      path: target.pathname + target.search,
      method: request.method,
      headers: {
        ...request.headers,
        host: request.headers.host,
        'x-forwarded-host': request.headers.host,
        'x-forwarded-proto': 'https'
      }
    }, (proxyResponse) => {
      const headers = rewriteLocationHeader(proxyResponse.headers, request.url);
      response.writeHead(proxyResponse.statusCode || 502, headers);
      proxyResponse.pipe(response);
    });
    proxyRequest.on('error', (error) => respondWithProxyError(response, error));
    request.pipe(proxyRequest);
  });
}

function rewriteLocationHeader(headers, requestUrl) {
  if (!headers.location) {
    return headers;
  }

  const canvasDockerDomain = process.env.CANVAS_DOCKER_DOMAIN || 'canvas.docker';
  const tlsTarget = `https://localhost:${tlsListenPort}`;

  let location = headers.location;
  const hasCanvasHttp = location.includes(`${canvasHttpHost}:${canvasHttpPort}`);
  const hasCanvasDocker = location.includes(canvasDockerDomain);

  if (!hasCanvasHttp && !hasCanvasDocker) return headers;

  location = location
    .replace(`http://${canvasHttpHost}:${canvasHttpPort}`, tlsTarget)
    .replace(`https://${canvasHttpHost}:${canvasHttpPort}`, tlsTarget);

  location = location
    .replace(new RegExp(`https?://${canvasDockerDomain}(:\\d+)?`), tlsTarget);

  if (requestUrl.includes('/api/lti/')) console.log(`    · [TLS-PROXY] OIDC redirige a ${location}`);
  return { ...headers, location };
}

function respondWithProxyError(response, error) {
  console.error(`[TLS-PROXY] Error reenviando a Canvas: ${error.message}`);
  if (!response.headersSent) response.writeHead(502, { 'Content-Type': 'text/plain' });
  response.end(`Bad Gateway: no se pudo contactar Canvas Local en ${canvasHttpHost}:${canvasHttpPort}`);
}

function createHttpsProxy(proxy) {
  const server = https.createServer({
    cert: fs.readFileSync(certificatePath),
    key: fs.readFileSync(keyPath)
  }, (request, response) => {
    const proxyRequest = http.request({
      host: '127.0.0.1',
      port: proxy.address().port,
      path: request.url,
      method: request.method,
      headers: { ...request.headers }
    }, (proxyResponse) => {
      response.writeHead(proxyResponse.statusCode || 502, proxyResponse.headers);
      proxyResponse.pipe(response);
    });
    proxyRequest.on('error', (error) => respondWithProxyError(response, error));
    request.pipe(proxyRequest);
  });
  server.setTimeout(300000);
  server.headersTimeout = 120000;
  server.keepAliveTimeout = 60000;
  return server;
}

function ensureCertificates() {
  if (fs.existsSync(certificatePath) && fs.existsSync(keyPath)) return;
  throw new Error(`[TLS-PROXY] Certificados mkcert no encontrados en ${certificatesDirectory}. ` +
    'Instala mkcert y genera certificados para localhost y 127.0.0.1.');
}

export function assertTlsProxyConfiguration() {
  ensureCertificates();
}

function listen(server, options) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.removeListener('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.removeListener('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(options);
  });
}

function close(server) {
  return new Promise((resolve) => server?.close(() => resolve()));
}

export async function startTlsProxy() {
  assertTlsProxyConfiguration();
  const proxy = createCanvasProxy();
  const server = createHttpsProxy(proxy);
  try {
    await listen(proxy, { host: '127.0.0.1', port: 0 });
    await listen(server, { port: tlsListenPort });
  } catch (error) {
    await close(server);
    await close(proxy);
    throw new Error(`[TLS-PROXY] No se pudo abrir https://localhost:${tlsListenPort}: ${error.message}`);
  }

  server.on('error', (error) => console.error(`[TLS-PROXY] Error del servidor: ${error.message}`));
  proxyInstance = proxy;
  serverInstance = server;
  console.info(`    [TLS-PROXY] HTTPS activo: https://localhost:${tlsListenPort} -> HTTP ${canvasHttpHost}:${canvasHttpPort}`);
  return server;
}

export function stopTlsProxy() {
  void close(serverInstance);
  void close(proxyInstance);
  serverInstance = null;
  proxyInstance = null;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  startTlsProxy().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
