import logger from '../utils/logger.js';
import path from 'path';

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
        try { isAllowed = isAllowed || urlObj.hostname === new URL(canvasBaseUrl).hostname; } catch(e) {}
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

      // Hacer fetch de la URL original
      console.time(`Download_Original_${fileUrl.substring(0, 30)}`);
      const fileResponse = await fetch(fileUrl, { headers });
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
      const gotenbergUrl = process.env.GOTENBERG_URL || 'http://localhost:3001/forms/libreoffice/convert';
      
      const formData = new FormData();
      const blob = new Blob([buffer], { type: contentType });
      formData.append('files', blob, filename); // Gotenberg requiere el campo 'files'

      logger.debug(`Enviando archivo ${filename} a Gotenberg (${gotenbergUrl}) para conversión a PDF...`);
      console.time(`Gotenberg_Conversion_${filename}`);
      const gotenbergResponse = await fetch(gotenbergUrl, {
        method: 'POST',
        body: formData,
      });
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
      logger.error('Error en FileController.preview:', error);
      res.status(500).json({ error: 'No se pudo generar la vista previa del archivo' });
    }
  }
}
