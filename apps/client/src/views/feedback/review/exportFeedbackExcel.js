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

    const sheetUtilidad = workbook.addWorksheet('Feedback Utility');
    sheetUtilidad.columns = [
      { header: 'Utility Metric (Students)', key: 'metrica', width: 45 },
      { header: 'Value', key: 'valor', width: 20 }
    ];
    sheetUtilidad.addRow({ metrica: 'Total Utility Evaluations', valor: countTotalEvaluacionesUtilidad });
    sheetUtilidad.addRow({ metrica: 'Total Feedbacks Considered Useful', valor: countEvaluacionesUtiles });
    sheetUtilidad.addRow({ metrica: 'Utility Percentage', valor: porcentajeUtilidad });
    sheetUtilidad.addRow({ metrica: 'Average Rating (Scale 1-5)', valor: avgEstudiante !== 'N/A' ? `${avgEstudiante} ⭐` : 'N/A' });
    styleHeader(sheetUtilidad);

    const worksheet = workbook.addWorksheet('Feedbacks');
    worksheet.columns = [
      { header: 'Student', key: 'student', width: 25 },
      { header: 'Course', key: 'courseId', width: 10 },
      { header: 'Assignment', key: 'assignmentId', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'AI Grade', key: 'grade', width: 20 },
      { header: 'Academic Profile', key: 'profile', width: 25 },
      { header: 'Was Useful? (Yes/No)', key: 'isUseful', width: 20 },
      { header: 'Student Rating', key: 'studentRating', width: 20 }
    ];

    filteredFeedbacks.forEach(fb => {
      worksheet.addRow({
        student: fb.student || '',
        courseId: fb.courseName || fb.courseId || '',
        assignmentId: fb.assignmentName || fb.assignmentId || '',
        status: fb.status || '',
        grade: fb.grade || '',
        profile: fb.profile || '',
        isUseful: fb.isUseful !== null && fb.isUseful !== undefined ? (fb.isUseful ? 'Yes' : 'No') : 'N/A',
        studentRating: fb.studentRating ? `${fb.studentRating} ⭐` : 'N/A'
      });
    });

    styleHeader(worksheet);

    // --- Hoja: System Notifications ---
    let systemErrors = [];
    try {
      const errorRes = await api.get('/system-notifications/pending');
      if (errorRes.exito) {
        systemErrors = errorRes.data || [];
      }
    } catch (e) {
      logger.error('exportFeedbackExcel', "Error fetching system notifications for excel", { error: e });
    }

    const sheetErrores = workbook.addWorksheet('System Notifications');
    sheetErrores.columns = [
      { header: 'Error Type', key: 'tipo_error', width: 25 },
      { header: 'Description', key: 'descripcion', width: 60 },
      { header: 'Count', key: 'count', width: 15 }
    ];
    
    const errorLabels = {
      'CANVAS_CONNECTION_FAILED': 'Canvas Connection Failed',
      'AI_GENERATION_FAILED': 'AI Generation Error',
      'INSUFFICIENT_DATA': 'Insufficient Data',
      'NOTIFICATION_FAILED': 'Notification Sending Failed'
    };

    const errorDescriptions = {
      'CANVAS_CONNECTION_FAILED': 'The server could not communicate with the Canvas API (timeout or unreachable endpoint). Verify that Canvas is operational and responding.',
      'AI_GENERATION_FAILED': 'An AI failure occurred when processing the prompt (e.g., request limit reached or provider internal error).',
      'INSUFFICIENT_DATA': 'Could not process request because the student has not submitted the assignment or the rubric lacks evaluation.',
      'NOTIFICATION_FAILED': 'The system failed to dispatch the generated feedback notification message or email to the student.'
    };

    if (systemErrors.length > 0) {
      systemErrors.forEach(err => {
        sheetErrores.addRow({
          tipo_error: errorLabels[err.tipo_error] || err.tipo_error,
          descripcion: errorDescriptions[err.tipo_error] || 'Error detected in the system without detailed description.',
          count: err.cantidad
        });
      });
    } else {
      sheetErrores.addRow({
        tipo_error: 'No notifications',
        descripcion: 'No errors',
        count: 0
      });
    }
    styleHeader(sheetErrores);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "feedbacks_report.xlsx");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    logger.info('exportFeedbackExcel', "Excel export generated.", { count: filteredFeedbacks.length });
    return true;
  } catch (error) {
    logger.error('exportFeedbackExcel', "Error generating Excel", { error });
    throw error;
  }
}
