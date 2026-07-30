import PDFDocument from 'pdfkit';
import logger from '../../../utils/logger.js';

export class PDFExportService {
  /**
   * Genera un buffer de PDF a partir de los datos estadísticos globales.
   */
  async generateReport(stats, ratings) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers = [];
        
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        
        // Cabecera
        doc.fontSize(22).fillColor('#0770a3').text('Reporte Global de Feedback - IA', { align: 'center' });
        doc.moveDown(2);
        
        // Resumen
        doc.fontSize(16).fillColor('#333333').text('Resumen General', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12).fillColor('#000000');
        doc.text(`Total Feedbacks Generados: ${stats.total}`);
        doc.text(`Feedbacks Aprobados: ${stats.byStatus['APROBADO'] || 0} (${stats.percentages['APROBADO'] || 0}%)`);
        doc.text(`Feedbacks Pendientes: ${stats.byStatus['PENDIENTE'] || 0} (${stats.percentages['PENDIENTE'] || 0}%)`);
        doc.text(`Feedbacks Rechazados: ${stats.byStatus['RECHAZADO'] || 0} (${stats.percentages['RECHAZADO'] || 0}%)`);
        doc.text(`Feedbacks Editados: ${stats.byStatus['EDITADO'] || 0} (${stats.percentages['EDITADO'] || 0}%)`);
        doc.moveDown(2);
        
        // Histograma de valoraciones
        doc.fontSize(16).fillColor('#333333').text('Distribución de Valoraciones (Estudiantes)', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12).fillColor('#000000');
        
        if (ratings.length === 0) {
          doc.text('No hay valoraciones registradas.');
        } else {
          ratings.sort((a, b) => b.rating - a.rating).forEach(r => {
            const stars = '⭐'.repeat(r.rating) || '0 Estrellas';
            doc.text(`${stars}  -->  ${r.count} votos`);
          });
        }
        
        // Pie de página
        doc.moveDown(4);
        doc.fontSize(10).fillColor('gray').text(`Generado el: ${new Date().toLocaleString()}`, { align: 'center' });
        
        doc.end();
      } catch (error) {
        logger.error('[PDFExportService] Error generando PDF:', { error });
        reject(error);
      }
    });
  }
}
