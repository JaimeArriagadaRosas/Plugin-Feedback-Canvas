import ExcelJS from 'exceljs';
import logger from '../../../utils/logger.js';

export class ExcelExportService {
  /**
   * Genera un buffer de Excel a partir de los datos proporcionados.
   * @param {Array} data - Lista de feedbacks generados.
   * @returns {Promise<Buffer>} - Archivo XLSX en memoria.
   */
  async generateExcel(data) {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Reporte Feedbacks');
      
      sheet.columns = [
        { header: 'ID Feedback', key: 'id', width: 12 },
        { header: 'ID Estudiante', key: 'estudiante_id', width: 15 },
        { header: 'ID Curso', key: 'curso_id', width: 15 },
        { header: 'ID Tarea', key: 'tarea_id', width: 15 },
        { header: 'Nota Original', key: 'nota_canvas', width: 15 },
        { header: 'Nota Local', key: 'nota_chile', width: 15 },
        { header: 'Estado', key: 'estado', width: 15 },
        { header: 'Fecha Generación', key: 'fecha_generacion', width: 25 },
        { header: 'Calificación Estudiante', key: 'calificacion_estudiante', width: 25 }
      ];
      
      data.forEach(row => {
        sheet.addRow({
          id: row.id,
          estudiante_id: row.estudiante_id,
          curso_id: row.curso_id,
          tarea_id: row.tarea_id,
          nota_canvas: row.nota_canvas || 'N/A',
          nota_chile: row.nota_chile || 'N/A',
          estado: row.estado,
          fecha_generacion: row.fecha_generacion ? new Date(row.fecha_generacion).toLocaleString() : 'N/A',
          calificacion_estudiante: row.calificacion_estudiante || 'No evaluado'
        });
      });

      // Estilos de la cabecera
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0770A3' } };

      const buffer = await workbook.xlsx.writeBuffer();
      return buffer;
    } catch (error) {
      logger.error('[ExcelExportService] Error generando Excel:', { error });
      throw error;
    }
  }
}
