import { api } from '@/api';
import logger from '../../../utils/logger';

export async function exportFeedbackExcel(filteredFeedbacks) {
  try {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();

    let countValoracionEstudiante = 0;
    let sumaValoracionEstudiante = 0;
    let countTotalEvaluacionesUtilidad = 0;
    let countEvaluacionesUtiles = 0;

    filteredFeedbacks.forEach(fb => {
      if (fb.studentRating) {
        sumaValoracionEstudiante += Number(fb.studentRating);
        countValoracionEstudiante++;
      }
      if (fb.isUseful !== null && fb.isUseful !== undefined) {
        countTotalEvaluacionesUtilidad++;
        if (fb.isUseful === true) {
          countEvaluacionesUtiles++;
        }
      }
    });

    const avgEstudiante = countValoracionEstudiante > 0 ? (sumaValoracionEstudiante / countValoracionEstudiante).toFixed(1) : 'N/A';
    const porcentajeUtilidad = countTotalEvaluacionesUtilidad > 0 ? ((countEvaluacionesUtiles / countTotalEvaluacionesUtilidad) * 100).toFixed(1) + '%' : 'N/A';

    const styleHeader = (sheet) => {
      const headerRow = sheet.getRow(1);
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0374B5' } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });
    };

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

    const worksheet = workbook.addWorksheet('Feedbacks');
    worksheet.columns = [
      { header: 'Estudiante', key: 'student', width: 25 },
      { header: 'Curso', key: 'courseId', width: 10 },
      { header: 'Asignacion', key: 'assignmentId', width: 15 },
      { header: 'Estado', key: 'status', width: 15 },
      { header: 'Calificacion IA', key: 'grade', width: 20 },
      { header: 'Perfil Academico', key: 'profile', width: 25 },
      { header: '¿Fue Útil? (Sí/No)', key: 'isUseful', width: 20 },
      { header: 'Valoración Estudiante', key: 'studentRating', width: 20 }
    ];

    filteredFeedbacks.forEach(fb => {
      worksheet.addRow({
        student: fb.student || '',
        courseId: fb.courseName || fb.courseId || '',
        assignmentId: fb.assignmentName || fb.assignmentId || '',
        status: fb.status || '',
        grade: fb.grade || '',
        profile: fb.profile || '',
        isUseful: fb.isUseful !== null && fb.isUseful !== undefined ? (fb.isUseful ? 'Sí' : 'No') : 'N/A',
        studentRating: fb.studentRating ? `${fb.studentRating} ⭐` : 'N/A'
      });
    });

    styleHeader(worksheet);

    // --- Hoja: Notificaciones de Sistema ---
    let systemErrors = [];
    try {
      const errorRes = await api.get('/system-notifications/pending');
      if (errorRes.exito) {
        systemErrors = errorRes.data || [];
      }
    } catch (e) {
      logger.error('exportFeedbackExcel', "Error fetching system notifications for excel", { error: e });
    }

    const sheetErrores = workbook.addWorksheet('Notificaciones de Sistema');
    sheetErrores.columns = [
      { header: 'Tipo Error', key: 'tipo_error', width: 25 },
      { header: 'Descripción', key: 'descripcion', width: 60 },
      { header: 'Cantidad', key: 'count', width: 15 }
    ];
    
    const errorLabels = {
      'CANVAS_CONNECTION_FAILED': 'Fallo conexión Canvas',
      'AI_GENERATION_FAILED': 'Error generación IA',
      'INSUFFICIENT_DATA': 'Datos insuficientes',
      'NOTIFICATION_FAILED': 'Fallo envío notificación'
    };

    const errorDescriptions = {
      'CANVAS_CONNECTION_FAILED': 'El servidor no pudo comunicarse con la API de Canvas (timeout o endpoint inaccesible). Verifica que Canvas esté operativo y respondiendo.',
      'AI_GENERATION_FAILED': 'Ocurrió un fallo con la Inteligencia Artificial al procesar el prompt (ej. límite de peticiones alcanzado o error interno del proveedor).',
      'INSUFFICIENT_DATA': 'Could not process request because the student has not submitted the assignment or the rubric lacks evaluation.',
      'NOTIFICATION_FAILED': 'El sistema falló al intentar despachar el mensaje o correo de notificación de feedback generado al estudiante.'
    };

    if (systemErrors.length > 0) {
      systemErrors.forEach(err => {
        sheetErrores.addRow({
          tipo_error: errorLabels[err.tipo_error] || err.tipo_error,
          descripcion: errorDescriptions[err.tipo_error] || 'Error detectado en el sistema sin descripción detallada.',
          count: err.cantidad
        });
      });
    } else {
      sheetErrores.addRow({
        tipo_error: 'No hay notificaciones',
        descripcion: 'Sin errores',
        count: 0
      });
    }
    styleHeader(sheetErrores);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "reporte_feedbacks.xlsx");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    logger.info('exportFeedbackExcel', "Export Excel generado.", { count: filteredFeedbacks.length });
    return true;
  } catch (error) {
    logger.error('exportFeedbackExcel', "Error generando Excel", { error });
    throw error;
  }
}
