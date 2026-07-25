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

      // Hacer fetch de la URL original
      console.time(`Download_Original_${fileUrl.substring(0, 30)}`);
      const fileResponse = await fetch(fileUrl);
      console.timeEnd(`Download_Original_${fileUrl.substring(0, 30)}`);
      
      if (!fileResponse.ok) {
        throw new Error(`No se pudo descargar el archivo de origen: ${fileResponse.statusText}`);
      }

      const contentType = fileResponse.headers.get('content-type') || '';
      const arrayBuffer = await fileResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      let filename = 'documento';
      
      try {
        const urlObj = new URL(fileUrl);
        filename = path.basename(urlObj.pathname) || 'documento';
      } catch (e) {
        // Ignorar error si no es una URL parseable
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
