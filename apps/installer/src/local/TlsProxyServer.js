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
    const headers = { ...request.headers };
    delete headers['x-forwarded-for'];
    delete headers['x-forwarded-host'];
    delete headers['x-forwarded-proto'];
    delete headers['x-forwarded-port'];
    delete headers['x-forwarded-ssl'];

    const proxyRequest = http.request({
      host: target.hostname,
      port: target.port,
      path: target.pathname + target.search,
      method: request.method,
      headers: {
        ...headers,
        host: headers.host,
        'x-forwarded-host': headers.host,
        'x-forwarded-proto': 'https',
        'x-forwarded-port': tlsListenPort.toString(),
        'x-forwarded-ssl': 'on'
      }
    }, (proxyResponse) => {
      const respHeaders = rewriteLocationHeader(proxyResponse.headers, request.url);
      response.writeHead(proxyResponse.statusCode || 502, respHeaders);
      proxyResponse.pipe(response);
    });
    proxyRequest.on('error', (error) => respondWithProxyError(response, error));
    request.pipe(proxyRequest);
  });
}

export function rewriteLocationHeader(headers, requestUrl) {
  if (!headers.location) {
    return headers;
  }

  const canvasDockerDomain = process.env.CANVAS_DOCKER_DOMAIN || 'canvas.docker';

  let loc;
  try {
    loc = new URL(headers.location, `http://${canvasHttpHost}:${canvasHttpPort}`);
  } catch {
    return headers;
  }

  const matchesCanvasHttp = loc.hostname === canvasHttpHost && (loc.port === canvasHttpPort.toString() || (!loc.port && canvasHttpPort === 80));
  const matchesCanvasDocker = loc.hostname === canvasDockerDomain;
  const matchesLocalhostTls = loc.hostname === 'localhost' && loc.port === tlsListenPort.toString();

  if (!matchesCanvasHttp && !matchesCanvasDocker && !matchesLocalhostTls) {
    return headers;
  }

  loc.protocol = 'https:';
  loc.hostname = 'localhost';
  loc.port = tlsListenPort.toString();

  const location = loc.toString();

  if (requestUrl.includes('/api/lti/')) console.log(`    · [TLS-PROXY] OIDC redirecting to ${loc.protocol}//${loc.hostname}:${loc.port}${loc.pathname}`);
  return { ...headers, location };
}

function respondWithProxyError(response, error) {
  console.error(`[TLS-PROXY] Error forwarding to Canvas: ${error.message}`);
  if (!response.headersSent) response.writeHead(502, { 'Content-Type': 'text/plain' });
  response.end(`Bad Gateway: could not contact Local Canvas at ${canvasHttpHost}:${canvasHttpPort}`);
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
  throw new Error(`[TLS-PROXY] mkcert certificates not found in ${certificatesDirectory}. ` +
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
    throw new Error(`[TLS-PROXY] Could not open https://localhost:${tlsListenPort}: ${error.message}`);
  }

  server.on('error', (error) => console.error(`[TLS-PROXY] Server error: ${error.message}`));
  proxyInstance = proxy;
  serverInstance = server;
  console.info(`    [TLS-PROXY] HTTPS active: https://localhost:${tlsListenPort} -> HTTP ${canvasHttpHost}:${canvasHttpPort}`);
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
