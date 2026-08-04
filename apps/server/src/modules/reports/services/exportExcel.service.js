import ExcelJS from 'exceljs';
import logger from '../../../utils/logger.js';

export class ExcelExportService {
  /**
   * Genera un buffer de Excel a partir de los datos proporcionados.
   * @param {Array} data - Lista de feedbacks generados.
   * @param {Array} auditLogs - Lista de logs críticos de auditoría.
   * @returns {Promise<Buffer>} - Archivo XLSX en memoria.
   */
  async generateExcel(data, auditLogs = [], migrationLogs = [], systemNotifications = [], templatesHistory = []) {
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
      let countEvaluacionesUtiles = 0;
      let countTotalEvaluacionesUtilidad = 0;

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
        
        if (row.es_util !== null && row.es_util !== undefined) {
          countTotalEvaluacionesUtilidad++;
          if (row.es_util === true) {
            countEvaluacionesUtiles++;
          }
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
      const porcentajeUtilidad = countTotalEvaluacionesUtilidad > 0 ? ((countEvaluacionesUtiles / countTotalEvaluacionesUtilidad) * 100).toFixed(1) + '%' : 'N/A';
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
      // HOJA 1B: UTILIDAD DEL FEEDBACK (RF50)
      // ============================================
      const sheetUtilidad = workbook.addWorksheet('Utilidad del Feedback');
      sheetUtilidad.columns = [
        { header: 'Métrica de Utilidad (Estudiantes)', key: 'metrica', width: 45 },
        { header: 'Valor', key: 'valor', width: 20 }
      ];
      sheetUtilidad.addRow({ metrica: 'Total de Evaluaciones de Utilidad', valor: countTotalEvaluacionesUtilidad });
      sheetUtilidad.addRow({ metrica: 'Total de Feedbacks Considerados Útiles', valor: countEvaluacionesUtiles });
      sheetUtilidad.addRow({ metrica: 'Porcentaje de Utilidad', valor: porcentajeUtilidad });
      sheetUtilidad.addRow({ metrica: 'Promedio Valoración (Escala 1-5)', valor: avgEstudiante !== 'N/A' ? `${avgEstudiante} ⭐` : 'N/A' });
      styleHeader(sheetUtilidad);

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
        { header: '¿Fue Útil? (Sí/No)', key: 'es_util', width: 20 },
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
          es_util: row.es_util !== null && row.es_util !== undefined ? (row.es_util ? 'Sí' : 'No') : 'N/A',
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

      // ============================================
      // HOJA 5: MÉTRICAS DE DESPLIEGUE (RF60)
      // ============================================
      const sheet5 = workbook.addWorksheet('Métricas de Despliegue');
      sheet5.columns = [
        { header: 'Fecha de Ejecución', key: 'fecha', width: 25 },
        { header: 'Versión / Archivo', key: 'version', width: 40 },
        { header: 'Estado', key: 'estado', width: 20 },
        { header: 'Detalle / Logs', key: 'logs', width: 80 }
      ];

      if (migrationLogs && migrationLogs.length > 0) {
        migrationLogs.forEach(log => {
          sheet5.addRow({
            fecha: log.ejecutado_en ? new Date(log.ejecutado_en).toLocaleString() : 'N/A',
            version: log.version,
            estado: log.status,
            logs: log.logs || 'Sin detalle'
          });
        });
      } else {
        sheet5.addRow({
          fecha: 'N/A',
          version: 'N/A',
          estado: 'N/A',
          logs: 'No hay registros de migración disponibles.'
        });
      }
      styleHeader(sheet5);

      // ============================================
      // HOJA 6: NOTIFICACIONES DE SISTEMA
      // ============================================
      const sheet6 = workbook.addWorksheet('Notificaciones de Sistema');
      sheet6.columns = [
        { header: 'ID Profesor', key: 'profesor_id', width: 20 },
        { header: 'Tipo Error', key: 'tipo_error', width: 30 },
        { header: 'Mensaje Error', key: 'mensaje_error', width: 60 },
        { header: 'Fecha Detección', key: 'creado_en', width: 25 },
        { header: 'Resuelto', key: 'resuelto', width: 15 }
      ];

      if (systemNotifications && systemNotifications.length > 0) {
        systemNotifications.forEach(notif => {
          sheet6.addRow({
            profesor_id: notif.profesor_id || 'N/A',
            tipo_error: notif.tipo_error || 'N/A',
            mensaje_error: notif.mensaje_error || 'Sin mensaje',
            creado_en: notif.creado_en ? new Date(notif.creado_en).toLocaleString() : 'N/A',
            resuelto: notif.resuelto ? 'Sí' : 'No'
          });
        });
      } else {
        sheet6.addRow({
          profesor_id: 'N/A',
          tipo_error: 'N/A',
          mensaje_error: 'No hay notificaciones de sistema.',
          creado_en: 'N/A',
          resuelto: 'N/A'
        });
      }
      styleHeader(sheet6);

      // ============================================
      // HOJA 7: HISTORIAL DE PLANTILLAS (RF13)
      // ============================================
      const sheet7 = workbook.addWorksheet('Historial de Plantillas');
      sheet7.columns = [
        { header: 'Nombre Plantilla', key: 'nombre', width: 35 },
        { header: 'Autor (Profesor ID)', key: 'autor', width: 25 },
        { header: 'Fecha de Creación', key: 'fecha_creacion', width: 25 },
        { header: 'Última Modificación', key: 'ultima_modificacion', width: 25 },
        { header: 'Frecuencia de Uso', key: 'frecuencia_uso', width: 20 }
      ];

      if (templatesHistory && templatesHistory.length > 0) {
        templatesHistory.forEach(template => {
          sheet7.addRow({
            nombre: template.nombre || 'Sin nombre',
            autor: template.autor || 'Sistema (Global)',
            fecha_creacion: template.fecha_creacion ? new Date(template.fecha_creacion).toLocaleString() : 'N/A',
            ultima_modificacion: template.ultima_modificacion ? new Date(template.ultima_modificacion).toLocaleString() : 'N/A',
            frecuencia_uso: template.frecuencia_uso || 0
          });
        });
      } else {
        sheet7.addRow({
          nombre: 'No hay plantillas registradas.',
          autor: 'N/A',
          fecha_creacion: 'N/A',
          ultima_modificacion: 'N/A',
          frecuencia_uso: 0
        });
      }
      styleHeader(sheet7);

      const buffer = await workbook.xlsx.writeBuffer();
      return buffer;
    } catch (error) {
      logger.error('[ExcelExportService] Error generando Excel:', { error });
      throw error;
    }
  }
}
