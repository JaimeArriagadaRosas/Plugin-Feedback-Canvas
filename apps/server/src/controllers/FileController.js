import logger from '../utils/logger.js';
import path from 'path';
import https from 'node:https';
import http from 'node:http';

// Función auxiliar para evadir la restricción de Node 18 fetch que bloquea el encabezado Host.
// Esto permite que el contenedor envíe peticiones a Canvas burlando su DNS Rebinding Protection.
function proxyFetch(url, headers) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      method: 'GET',
      headers: headers,
      rejectUnauthorized: false
    };
    
    const client = urlObj.protocol === 'https:' ? https : http;
    const req = client.request(url, options, (res) => {
      let data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(data);
        
        // Simular el objeto Headers nativo de fetch
        const responseHeaders = {
          get: (name) => res.headers[name.toLowerCase()] || null,
          raw: () => res.headers
        };

        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusText: res.statusMessage,
          headers: responseHeaders,
          json: async () => JSON.parse(buffer.toString('utf-8')),
          text: async () => buffer.toString('utf-8'),
          arrayBuffer: async () => buffer
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

export default class FileController {
  constructor(canvasService) {
    this.canvasService = canvasService;
  }

  async preview(req, res, next) {
    try {
      const fileUrl = req.query.url;
      if (!fileUrl) {
        return res.status(400).json({ error: 'Falta la URL del archivo' });
      }

      logger.debug(`FileController.preview - URL solicitada: ${fileUrl}`);

      // Validación SSRF básica
      let urlObj;
      try {
        urlObj = new URL(fileUrl);
      } catch (e) {
        return res.status(400).json({ error: 'URL inválida' });
      }

      const allowedDomains = ['instructure.com', 'localhost', '127.0.0.1'];
      const canvasBaseUrl = process.env.CANVAS_BASE_URL || '';
      let isAllowed = allowedDomains.some(d => urlObj.hostname.endsWith(d));
      if (canvasBaseUrl) {
        try { isAllowed = isAllowed || urlObj.hostname === new URL(canvasBaseUrl).hostname; } catch(e) { logger.debug('Error checking allowed domain', { error: e.message }); }
      }
      if (!isAllowed) {
        logger.warn(`Intento de SSRF detectado en preview: ${fileUrl}`);
        return res.status(403).json({ error: 'Dominio de origen no permitido.' });
      }

      // Obtener token de Canvas si existe el contexto LTI
      const teacherId = req.appIdentity?.canonicalUserId;
      const headers = {};
      if (teacherId && this.canvasService && this.canvasService.tokenManager) {
        try {
          const token = await this.canvasService.tokenManager.getValidToken(teacherId);
          if (token) headers['Authorization'] = `Bearer ${token}`;
        } catch (e) {
          logger.warn(`No se pudo cargar token Canvas para preview: ${e.message}`);
        }
      }

      // Si la URL apunta a localhost (típico en desarrollo local), redirigir al host 
      // para que el contenedor Docker pueda llegar a la instancia de Canvas (en la máquina host).
      let fetchUrl = fileUrl;
      let useProxyFetch = false;
      const isLocal = fetchUrl.includes('localhost') || fetchUrl.includes('127.0.0.1');
      if (isLocal) {
        useProxyFetch = true;
        const proxyHost = 'host.docker.internal';
        fetchUrl = fetchUrl.replace(/localhost|127\.0\.0\.1/, proxyHost);
        
        // CORRECCIÓN CLAVE: Canvas (Rails) bloquea peticiones con encabezados Host no coincidentes (DNS Rebinding protection)
        // Debemos forzar el header Host original (ej. localhost:8443) para que Canvas acepte la petición.
        try {
          headers['Host'] = new URL(fileUrl).host;
        } catch (e) { logger.debug('Error parsing URL', { error: e.message }); }

        logger.info(`[FileController] Reescribiendo URL local para Docker: de ${fileUrl} a ${fetchUrl} (Host: ${headers['Host']})`);
      }

      // Si es una URL web de Canvas (/files/ID/download), rechazará el token Bearer (error 403 Forbidden).
      // Debemos consultar la API primero para obtener el enlace de descarga real temporal.
      const fileIdMatch = fetchUrl.match(/\/files\/(\d+)/);
      if (fileIdMatch && !fetchUrl.includes('/api/v1/')) {
        const fileId = fileIdMatch[1];
        const baseUrl = fetchUrl.split('/files/')[0];
        const apiUrl = `${baseUrl}/api/v1/files/${fileId}`;
        
        logger.info(`[FileController] Transformando URL web a API para autorizar descarga: ${apiUrl}`);
        
        const apiResponse = useProxyFetch ? await proxyFetch(apiUrl, { ...headers }) : await fetch(apiUrl, { headers });
        if (!apiResponse.ok) {
           const errorBody = await apiResponse.text();
           throw new Error(`Fallo al consultar la API del archivo (HTTP ${apiResponse.status}): ${apiResponse.statusText} - Body: ${errorBody.substring(0, 200)}`);
        }
        const fileData = await apiResponse.json();
        if (fileData.url) {
           fetchUrl = fileData.url;
           logger.info(`[FileController] URL de descarga temporal obtenida de la API con éxito.`);
        }
      }

      // Hacer fetch de la URL original (o la temporal obtenida de la API)
      logger.info(`Iniciando descarga de documento desde: ${fetchUrl.substring(0, 100)}...`);
      console.time(`Download_Original_${fileUrl.substring(0, 30)}`);
      const fileResponse = useProxyFetch ? await proxyFetch(fetchUrl, { ...headers }) : await fetch(fetchUrl, { headers });
      console.timeEnd(`Download_Original_${fileUrl.substring(0, 30)}`);
      
      if (!fileResponse.ok) {
        throw new Error(`No se pudo descargar el archivo de origen: ${fileResponse.statusText}`);
      }

      const contentType = fileResponse.headers.get('content-type') || '';
      const arrayBuffer = await fileResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      let filename = path.basename(urlObj.pathname) || 'documento';
      
      // Si el nombre no tiene extensión, intentar deducirla del contentType
      if (!path.extname(filename)) {
        if (contentType.includes('wordprocessingml.document')) filename += '.docx';
        else if (contentType.includes('msword')) filename += '.doc';
        else if (contentType.includes('presentationml.presentation')) filename += '.pptx';
        else if (contentType.includes('ms-powerpoint')) filename += '.ppt';
        else if (contentType.includes('spreadsheetml.sheet')) filename += '.xlsx';
        else if (contentType.includes('ms-excel')) filename += '.xls';
      }
      
      const extension = path.extname(filename).toLowerCase();

      // Si es un PDF original, lo servimos directamente
      if (extension === '.pdf' || contentType.includes('application/pdf')) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        return res.send(buffer);
      }

      // Si no es PDF (ej. Word, Excel), lo enviamos a Gotenberg
      // Si NODE_ENV no está definido o es development, asumimos que Node corre en el Host, por lo que Gotenberg está en localhost:3001
      // Si corren la app vía Docker Compose, la variable de entorno GOTENBERG_URL="http://gotenberg:3000" sobrescribirá esto.
      let gotenbergUrl = process.env.GOTENBERG_URL || 'http://localhost:3001';
      // Asegurar que use el endpoint correcto para Gotenberg v8
      if (!gotenbergUrl.includes('/forms/')) {
        gotenbergUrl = `${gotenbergUrl.replace(/\/$/, '')}/forms/libreoffice/convert`;
      } else if (gotenbergUrl.endsWith('/pdf')) {
        // Corrección por si alguien puso la URL antigua de Gotenberg v7
        gotenbergUrl = gotenbergUrl.replace(/\/pdf$/, '');
      }
      
      const formData = new FormData();
      const blob = new Blob([buffer], { type: contentType });
      formData.append('files', blob, filename); // Gotenberg requiere el campo 'files'

      logger.info(`Enviando archivo ${filename} a Gotenberg (${gotenbergUrl}) para conversión a PDF...`);
      console.time(`Gotenberg_Conversion_${filename}`);
      let gotenbergResponse;
      try {
        gotenbergResponse = await fetch(gotenbergUrl, {
          method: 'POST',
          body: formData,
        });
      } catch (gotenbergErr) {
        throw new Error(`Error de red al contactar a Gotenberg: ${gotenbergErr.message} (Causa: ${gotenbergErr.cause ? gotenbergErr.cause.message : 'Desconocida'})`);
      }
      console.timeEnd(`Gotenberg_Conversion_${filename}`);

      if (!gotenbergResponse.ok) {
        const errText = await gotenbergResponse.text();
        logger.error(`Error en Gotenberg (${gotenbergResponse.status}): ${errText}`);
        throw new Error(`Falló la conversión a PDF: ${gotenbergResponse.statusText}`);
      }

      const pdfArrayBuffer = await gotenbergResponse.arrayBuffer();
      const pdfBuffer = Buffer.from(pdfArrayBuffer);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}.pdf"`);
      return res.send(pdfBuffer);
    } catch (error) {
      logger.error('Error en FileController.preview:', { error: error.message, stack: error.stack });
      res.status(500).json({ error: 'No se pudo generar la vista previa del archivo' });
    }
  }
}
