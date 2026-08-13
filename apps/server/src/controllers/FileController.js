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
        reject(new Error('El archivo supera el límite de vista previa de 25 MB.'));
        return;
      }
      const chunks = [];
      let size = 0;
      response.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_PREVIEW_BYTES) {
          request.destroy(new Error('El archivo supera el límite de vista previa de 25 MB.'));
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
      const headers = await this._getCanvasHeaders(req.appIdentity?.canonicalUserId);
      const requestContext = this._prepareRequest(originalUrl, headers);
      const downloadUrl = await this._resolveDownloadUrl(requestContext);
      const file = await this._downloadFile(downloadUrl, requestContext);
      return this._respondWithPreview(res, originalUrl, file);
    } catch (error) {
      logger.error('Error en FileController.preview:', { error: error.message, stack: error.stack });
      return res.status(this._statusFor(error)).json({ error: error.message || 'No se pudo generar la vista previa del archivo' });
    }
  }

  _validateUrl(rawUrl) {
    if (!rawUrl) throw this._httpError(400, 'Falta la URL del archivo');
    let url;
    try {
      url = new URL(rawUrl);
    } catch {
      throw this._httpError(400, 'URL inválida');
    }
    if (!['http:', 'https:'].includes(url.protocol) || !this._isTrustedHost(url.hostname)) {
      throw this._httpError(403, 'Dominio de origen no permitido.');
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

  async _getCanvasHeaders(teacherId) {
    const headers = {};
    if (!teacherId || !this.canvasService?.tokenManager) return headers;
    try {
      const token = await this.canvasService.tokenManager.getValidToken(teacherId);
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch (error) {
      logger.warn('No se pudo cargar token Canvas para preview', { error: error.message });
    }
    return headers;
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
    logger.info('[FileController] URL local redirigida para contenedor', { from: originalUrl.host, to: proxyHost });
    return { url: rewritten.toString(), headers, useProxyFetch: true };
  }

  async _resolveDownloadUrl(context) {
    const fileMatch = context.url.match(/\/files\/(\d+)/);
    if (!fileMatch || context.url.includes('/api/v1/')) return context.url;
    const baseUrl = context.url.split('/files/')[0];
    const apiUrl = `${baseUrl}/api/v1/files/${fileMatch[1]}`;
    const response = await this._fetch(apiUrl, context);
    if (!response.ok) throw new Error(`Fallo al consultar la API del archivo (HTTP ${response.status}).`);
    const file = await response.json();
    return file.url || context.url;
  }

  async _downloadFile(downloadUrl, context) {
    const response = await this._fetch(downloadUrl, context);
    if (!response.ok) throw new Error(`No se pudo descargar el archivo de origen: ${response.statusText}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_PREVIEW_BYTES) throw new Error('El archivo supera el límite de vista previa de 25 MB.');
    return { buffer, contentType: response.headers.get('content-type') || '' };
  }

  _fetch(url, context) {
    const usesRewrittenHost = context.useProxyFetch && new URL(url).hostname === new URL(context.url).hostname;
    return usesRewrittenHost ? proxyFetch(url, { ...context.headers }) : fetch(url, { headers: context.headers });
  }

  async _respondWithPreview(res, originalUrl, file) {
    const filename = this._filenameFor(originalUrl.pathname, file.contentType);
    if (this._isPdf(filename, file.contentType)) return this._sendPdf(res, file.buffer, filename);
    const pdf = await this._convertToPdf(file.buffer, file.contentType, filename);
    return this._sendPdf(res, pdf, `${filename}.pdf`);
  }

  _filenameFor(pathname, contentType) {
    let filename = path.basename(pathname) || 'documento';
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
    const formData = new FormData();
    formData.append('files', new Blob([buffer], { type: contentType }), filename);
    let response;
    try {
      response = await fetch(endpoint, { method: 'POST', body: formData });
    } catch (error) {
      throw new Error(`Error de red al contactar a Gotenberg: ${error.message}`);
    }
    if (!response.ok) {
      logger.error('Error en Gotenberg', { status: response.status, body: await response.text() });
      throw new Error(`Falló la conversión a PDF: ${response.statusText}`);
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

  _httpError(status, message) {
    return Object.assign(new Error(message), { status });
  }

  _statusFor(error) {
    return error.status || 500;
  }
}
