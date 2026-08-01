import ExcelJS from 'exceljs';
import logger from '../../../utils/logger.js';

export class ExcelExportService {
  /**
   * Genera un buffer de Excel a partir de los datos proporcionados.
   * @param {Array} data - Lista de feedbacks generados.
   * @param {Array} auditLogs - Lista de logs críticos de auditoría.
   * @returns {Promise<Buffer>} - Archivo XLSX en memoria.
   */
  async generateExcel(data, auditLogs = []) {
    try {
      const workbook = new ExcelJS.Workbook();
      
      // ============================================
      // 0. CALCULAR MÉTRICAS EN MEMORIA
      // ============================================
      const totalFeedbacks = data.length;
      let totalAprobados = 0;
      let totalPendientes = 0;
      let totalEditados = 0;
      let totalRechazados = 0;
      
      let sumaValoracionProfesor = 0;
      let countValoracionProfesor = 0;
      let sumaValoracionEstudiante = 0;
      let countValoracionEstudiante = 0;

      const cursosMap = new Map();

      data.forEach(row => {
        const estado = row.estado || 'PENDIENTE';
        if (estado === 'APROBADO') totalAprobados++;
        else if (estado === 'PENDIENTE') totalPendientes++;
        else if (estado === 'EDITADO') totalEditados++;
        else if (estado === 'RECHAZADO') totalRechazados++;

        if (row.calificacion_profesor) {
          sumaValoracionProfesor += Number(row.calificacion_profesor);
          countValoracionProfesor++;
        }
        if (row.calificacion_estudiante) {
          sumaValoracionEstudiante += Number(row.calificacion_estudiante);
          countValoracionEstudiante++;
        }

        const cursoKey = row.curso_id;
        if (!cursosMap.has(cursoKey)) {
          cursosMap.set(cursoKey, {
            nombre: row.nombre_curso || `Curso ${cursoKey}`,
            total: 0,
            aprobados: 0,
            sumaProfesor: 0,
            countProfesor: 0,
            sumaEstudiante: 0,
            countEstudiante: 0
          });
        }
        const c = cursosMap.get(cursoKey);
        c.total++;
        if (estado === 'APROBADO') c.aprobados++;
        if (row.calificacion_profesor) {
          c.sumaProfesor += Number(row.calificacion_profesor);
          c.countProfesor++;
        }
        if (row.calificacion_estudiante) {
          c.sumaEstudiante += Number(row.calificacion_estudiante);
          c.countEstudiante++;
        }
      });

      const avgProfesor = countValoracionProfesor > 0 ? (sumaValoracionProfesor / countValoracionProfesor).toFixed(1) : 'N/A';
      const avgEstudiante = countValoracionEstudiante > 0 ? (sumaValoracionEstudiante / countValoracionEstudiante).toFixed(1) : 'N/A';
      const tasaAprobacion = totalFeedbacks > 0 ? ((totalAprobados / totalFeedbacks) * 100).toFixed(1) + '%' : 'N/A';

      const styleHeader = (sheet) => {
        const headerRow = sheet.getRow(1);
        headerRow.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0374B5' } };
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });
      };

      // ============================================
      // HOJA 1: MÉTRICAS GLOBALES
      // ============================================
      const sheet1 = workbook.addWorksheet('Métricas Globales');
      sheet1.columns = [
        { header: 'Métrica', key: 'metrica', width: 40 },
        { header: 'Valor', key: 'valor', width: 20 }
      ];
      sheet1.addRow({ metrica: 'Total de Feedbacks Generados', valor: totalFeedbacks });
      sheet1.addRow({ metrica: 'Tasa de Aprobación Global', valor: tasaAprobacion });
      sheet1.addRow({ metrica: 'Promedio Valoración Profesores', valor: avgProfesor !== 'N/A' ? `${avgProfesor} ⭐` : 'N/A' });
      sheet1.addRow({ metrica: 'Promedio Valoración Estudiantes', valor: avgEstudiante !== 'N/A' ? `${avgEstudiante} ⭐` : 'N/A' });
      sheet1.addRow({ metrica: '---', valor: '---' });
      sheet1.addRow({ metrica: 'Total Aprobados', valor: totalAprobados });
      sheet1.addRow({ metrica: 'Total Editados', valor: totalEditados });
      sheet1.addRow({ metrica: 'Total Pendientes', valor: totalPendientes });
      sheet1.addRow({ metrica: 'Total Rechazados', valor: totalRechazados });
      styleHeader(sheet1);

      // ============================================
      // HOJA 2: MÉTRICAS POR CURSO
      // ============================================
      const sheet2 = workbook.addWorksheet('Métricas por Curso');
      sheet2.columns = [
        { header: 'Nombre Curso', key: 'curso', width: 35 },
        { header: 'Total Feedbacks', key: 'total', width: 15 },
        { header: 'Aprobados', key: 'aprobados', width: 15 },
        { header: 'Valoración Profesor', key: 'valProf', width: 20 },
        { header: 'Valoración Estudiante', key: 'valEst', width: 20 }
      ];
      
      cursosMap.forEach((c) => {
        const pAvg = c.countProfesor > 0 ? (c.sumaProfesor / c.countProfesor).toFixed(1) : 'N/A';
        const eAvg = c.countEstudiante > 0 ? (c.sumaEstudiante / c.countEstudiante).toFixed(1) : 'N/A';
        sheet2.addRow({
          curso: c.nombre,
          total: c.total,
          aprobados: c.aprobados,
          valProf: pAvg !== 'N/A' ? `${pAvg} ⭐` : 'N/A',
          valEst: eAvg !== 'N/A' ? `${eAvg} ⭐` : 'N/A'
        });
      });
      styleHeader(sheet2);

      // ============================================
      // HOJA 3: DETALLE HISTÓRICO
      // ============================================
      const sheet3 = workbook.addWorksheet('Detalle Histórico');
      sheet3.columns = [
        { header: 'Fecha de Generación', key: 'fecha_generacion', width: 25 },
        { header: 'Nombre Curso', key: 'curso', width: 30 },
        { header: 'Nombre Tarea', key: 'asignacion', width: 30 },
        { header: 'Nombre Estudiante', key: 'estudiante', width: 30 },
        { header: 'ID Profesor', key: 'profesor_id', width: 15 },
        { header: 'Estado', key: 'estado', width: 15 },
        { header: 'Nota Original', key: 'nota_canvas', width: 15 },
        { header: 'Calificación IA', key: 'nota_chile', width: 15 },
        { header: 'Valoración Profesor', key: 'val_prof', width: 20 },
        { header: 'Valoración Estudiante', key: 'val_est', width: 20 }
      ];
      
      data.forEach(row => {
        sheet3.addRow({
          fecha_generacion: row.fecha_generacion ? new Date(row.fecha_generacion).toLocaleString() : 'N/A',
          curso: row.nombre_curso || `Curso ${row.curso_id}`,
          asignacion: row.nombre_tarea || `Tarea ${row.tarea_id}`,
          estudiante: row.nombre_estudiante || `Estudiante ${row.estudiante_id}`,
          profesor_id: row.profesor_id || 'N/A',
          estado: row.estado || 'PENDIENTE',
          nota_canvas: row.nota_canvas !== null && row.nota_canvas !== undefined ? row.nota_canvas : 'N/A',
          nota_chile: row.nota_chile !== null && row.nota_chile !== undefined ? row.nota_chile : 'N/A',
          val_prof: row.calificacion_profesor ? `${row.calificacion_profesor} ⭐` : 'N/A',
          val_est: row.calificacion_estudiante ? `${row.calificacion_estudiante} ⭐` : 'N/A'
        });
      });
      styleHeader(sheet3);

      // ============================================
      // HOJA 4: AUDITORÍA (CRÍTICOS)
      // ============================================
      const sheet4 = workbook.addWorksheet('Auditoría (Críticos)');
      sheet4.columns = [
        { header: 'Fecha', key: 'fecha', width: 25 },
        { header: 'Usuario ID', key: 'usuario', width: 20 },
        { header: 'Acción / Tipo de Evento', key: 'accion', width: 45 },
        { header: 'Detalle e IP', key: 'detalle', width: 60 }
      ];

      if (auditLogs && auditLogs.length > 0) {
        auditLogs.forEach(log => {
          sheet4.addRow({
            fecha: log.fecha ? new Date(log.fecha).toLocaleString() : 'N/A',
            usuario: log.usuario_id || 'SISTEMA',
            accion: log.accion,
            detalle: `${log.detalle || 'Sin detalle'} | IP: ${log.ip_address || 'N/A'}`
          });
        });
      } else {
        sheet4.addRow({
          fecha: 'N/A',
          usuario: 'N/A',
          accion: 'No se detectaron incidentes de seguridad en este periodo.',
          detalle: '---'
        });
      }
      styleHeader(sheet4);

      const buffer = await workbook.xlsx.writeBuffer();
      return buffer;
    } catch (error) {
      logger.error('[ExcelExportService] Error generando Excel:', { error });
      throw error;
    }
  }
}
