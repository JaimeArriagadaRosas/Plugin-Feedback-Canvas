import http from 'node:http';
import https from 'node:https';
import path from 'node:path';

import logger from '../utils/logger.js';

const MAX_PREVIEW_BYTES = 25 * 1024 * 1024;
const TRUSTED_CANVAS_SUFFIXES = ['instructure.com'];

function proxyFetch(url, headers) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const client = target.protocol === 'https:' ? https : http;
    const request = client.request(target, { method: 'GET', headers, rejectUnauthorized: false }, (response) => {
      const declaredSize = Number(response.headers['content-length'] || 0);
      if (declaredSize > MAX_PREVIEW_BYTES) {
        response.resume();
        const err = new Error('File exceeds the 25 MB preview limit.');
        err.status = 413; err.code = 'FILE_TOO_LARGE';
        reject(err);
        return;
      }
      const chunks = [];
      let size = 0;
      response.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_PREVIEW_BYTES) {
          request.destroy();
          const err = new Error('File exceeds the 25 MB preview limit.');
          err.status = 413; err.code = 'FILE_TOO_LARGE';
          reject(err);
          return;
        }
        chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => resolve(createProxyResponse(response, Buffer.concat(chunks))));
    });
    request.on('error', reject);
    request.end();
  });
}

function createProxyResponse(response, buffer) {
  return {
    ok: response.statusCode >= 200 && response.statusCode < 300,
    status: response.statusCode,
    statusText: response.statusMessage,
    headers: { get: (name) => response.headers[name.toLowerCase()] || null },
    json: async () => JSON.parse(buffer.toString('utf8')),
    text: async () => buffer.toString('utf8'),
    arrayBuffer: async () => buffer
  };
}

export default class FileController {
  constructor(canvasService) {
    this.canvasService = canvasService;
  }

  async preview(req, res) {
    try {
      const originalUrl = this._validateUrl(req.query.url);
      const headers = {};
      if (req.canvasToken) headers.Authorization = `Bearer ${req.canvasToken}`;
      const requestContext = this._prepareRequest(originalUrl, headers);
      const downloadUrl = await this._resolveDownloadUrl(requestContext);
      const file = await this._downloadFile(downloadUrl, requestContext);
      return await this._respondWithPreview(res, originalUrl, file);
    } catch (error) {
      logger.error('Error in FileController.preview:', {
        error: error.message,
        code: error.code,
        cause: error.cause?.message || error.cause?.code || error.cause,
        stack: error.stack
      });
      return res.status(error.status || 500).json({
        error: error.message || 'Could not generate file preview',
        code: error.code || 'INTERNAL_ERROR'
      });
    }
  }

  _validateUrl(rawUrl) {
    if (!rawUrl) throw this._httpError(400, 'INVALID_FILE_URL', 'Missing file URL');
    let url;
    try {
      url = new URL(rawUrl);
    } catch {
      throw this._httpError(400, 'INVALID_FILE_URL', 'Invalid URL');
    }
    if (!['http:', 'https:'].includes(url.protocol) || !this._isTrustedHost(url.hostname)) {
      throw this._httpError(403, 'INVALID_FILE_URL', 'Origin domain not allowed.');
    }
    return url;
  }

  _isTrustedHost(hostname) {
    const canvasHost = this._canvasHost();
    const matchesCanvas = canvasHost && hostname === canvasHost;
    const matchesSuffix = TRUSTED_CANVAS_SUFFIXES.some((suffix) =>
      hostname === suffix || hostname.endsWith(`.${suffix}`));
    return matchesCanvas || matchesSuffix || ['localhost', '127.0.0.1'].includes(hostname);
  }

  _canvasHost() {
    try {
      return new URL(process.env.CANVAS_BASE_URL || '').hostname;
    } catch {
      return null;
    }
  }



  _prepareRequest(originalUrl, headers) {
    const proxyHost = process.env.FILE_PREVIEW_LOCAL_HOST ||
      (process.env.RUNNING_IN_CONTAINER === 'true' ? 'host.docker.internal' : null);
    if (!proxyHost || !['localhost', '127.0.0.1'].includes(originalUrl.hostname)) {
      return { url: originalUrl.toString(), headers, useProxyFetch: false };
    }
    const rewritten = new URL(originalUrl);
    rewritten.hostname = proxyHost;
    headers.Host = originalUrl.host;
    logger.info('[FileController] Local URL redirected for container', { from: originalUrl.host, to: proxyHost });
    return { url: rewritten.toString(), headers, useProxyFetch: true };
  }

  async _resolveDownloadUrl(context) {
    const fileMatch = context.url.match(/\/files\/(\d+)/);
    if (!fileMatch || context.url.includes('/api/v1/')) return context.url;
    const baseUrl = context.url.split('/files/')[0];
    const apiUrl = `${baseUrl}/api/v1/files/${fileMatch[1]}`;
    const response = await this._fetch(apiUrl, context);
    if (!response.ok) {
      const code = response.status === 401 ? 'AUTH_CANVAS' : 'CANVAS_FILE_API';
      throw this._httpError(response.status, code, `Failed to query the file API (HTTP ${response.status}).`);
    }
    const file = await response.json();
    let finalUrl = file.url || context.url;

    if (process.env.STARTUP_MODE === '3' && finalUrl.startsWith('http://localhost:8443')) {
      finalUrl = finalUrl.replace(/^http:/, 'https:');
      const u = new URL(finalUrl);
      logger.info('[FileController] TLS fallback applied to file.url', {
        protocol: u.protocol, hostname: u.hostname, port: u.port, pathname: u.pathname
      });
    }

    return finalUrl;
  }

  async _downloadFile(downloadUrl, context) {
    let currentUrl = downloadUrl;
    let response;
    let redirects = 0;
    const MAX_REDIRECTS = 5;

    let headers = { ...context.headers };

    while (redirects <= MAX_REDIRECTS) {
      const destOrigin = new URL(currentUrl).origin;
      const canvasOrigin = new URL(context.url).origin;

      if (destOrigin !== canvasOrigin) {
        delete headers.Authorization;
        delete headers.authorization;
        delete headers.Host;
        delete headers.host;
      }

      const downloadContext = { ...context, headers };
      response = await this._fetch(currentUrl, downloadContext);

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        redirects++;
        if (redirects > MAX_REDIRECTS) {
          throw this._httpError(502, 'TOO_MANY_REDIRECTS', 'Maximum redirect limit reached');
        }
        let loc = response.headers.get('location');
        if (!loc) break;

        const nextUrlObj = new URL(loc, currentUrl);
        const currentUrlObj = new URL(currentUrl);
        if (currentUrlObj.searchParams.has('sf_verifier') && !nextUrlObj.searchParams.has('sf_verifier')) {
          nextUrlObj.searchParams.set('sf_verifier', currentUrlObj.searchParams.get('sf_verifier'));
        }

        loc = nextUrlObj.toString();

        if (process.env.STARTUP_MODE === '3' && loc.startsWith('http://localhost:8443')) {
          loc = loc.replace(/^http:/, 'https:');
          const u = new URL(loc);
          logger.info('[FileController] TLS fallback applied to Location redirect', {
            protocol: u.protocol, hostname: u.hostname, port: u.port, pathname: u.pathname
          });
        }
        currentUrl = loc;
        continue;
      }
      break;
    }
    if (!response.ok) {
      const code = response.status === 401 ? 'AUTH_CANVAS' : 'CANVAS_FILE_DOWNLOAD';
      const status = response.status === 401 ? 401 : 502;
      throw this._httpError(status, code, `Could not download source file: ${response.statusText}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_PREVIEW_BYTES) throw this._httpError(413, 'FILE_TOO_LARGE', 'File exceeds the 25 MB preview limit.');
    return { buffer, contentType: response.headers.get('content-type') || '' };
  }

  _fetch(url, context) {
    const urlObj = new URL(url);
    const usesRewrittenHost = context.useProxyFetch &&
      (urlObj.hostname === new URL(context.url).hostname ||
       urlObj.hostname === 'localhost' ||
       urlObj.hostname === '127.0.0.1');

    if (usesRewrittenHost && context.useProxyFetch) {
      const rewrittenUrl = new URL(url);
      rewrittenUrl.hostname = new URL(context.url).hostname;
      return proxyFetch(rewrittenUrl.toString(), { ...context.headers });
    }

    const dispatcher = this.canvasService?.httpClient?.dispatcher;
    return fetch(url, { headers: context.headers, dispatcher, redirect: 'manual' });
  }

  async _respondWithPreview(res, originalUrl, file) {
    const filename = this._filenameFor(originalUrl.pathname, file.contentType);
    if (this._isPdf(filename, file.contentType)) return this._sendPdf(res, file.buffer, filename);
    const pdf = await this._convertToPdf(file.buffer, file.contentType, filename);
    return this._sendPdf(res, pdf, `${filename}.pdf`);
  }

  _filenameFor(pathname, contentType) {
    let filename = path.basename(pathname) || 'document';
    if (path.extname(filename)) return filename;
    const extensions = [
      ['wordprocessingml.document', '.docx'], ['msword', '.doc'],
      ['presentationml.presentation', '.pptx'], ['ms-powerpoint', '.ppt'],
      ['spreadsheetml.sheet', '.xlsx'], ['ms-excel', '.xls']
    ];
    return `${filename}${extensions.find(([type]) => contentType.includes(type))?.[1] || ''}`;
  }

  _isPdf(filename, contentType) {
    return path.extname(filename).toLowerCase() === '.pdf' || contentType.includes('application/pdf');
  }

  async _convertToPdf(buffer, contentType, filename) {
    const endpoint = this._gotenbergEndpoint();
    const baseUrl = new URL(endpoint).origin;

    try {
      const healthRes = await fetch(`${baseUrl}/health`, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
      if (!healthRes.ok) throw new Error(`Healthcheck returned HTTP ${healthRes.status}`);
    } catch (error) {
      throw this._httpError(503, 'GOTENBERG_UNAVAILABLE', `Network error contacting Gotenberg: ${error.message}`);
    }

    const formData = new FormData();
    formData.append('files', new Blob([buffer], { type: contentType }), filename);
    let response;
    try {
      response = await fetch(endpoint, { method: 'POST', body: formData });
    } catch (error) {
      throw this._httpError(502, 'GOTENBERG_CONVERSION', `Network failure during conversion: ${error.message}`);
    }
    if (!response.ok) {
      logger.error('Gotenberg Error', { status: response.status });
      throw this._httpError(502, 'GOTENBERG_CONVERSION', `PDF conversion failed: ${response.statusText}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  _gotenbergEndpoint() {
    let url = process.env.GOTENBERG_URL || 'http://localhost:3001';
    if (!url.includes('/forms/')) return `${url.replace(/\/$/, '')}/forms/libreoffice/convert`;
    return url.endsWith('/pdf') ? url.replace(/\/pdf$/, '') : url;
  }

  _sendPdf(res, buffer, filename) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename.replaceAll('"', '')}"`);
    return res.send(buffer);
  }

  _httpError(status, code, message) {
    return Object.assign(new Error(message), { status, code });
  }
}
