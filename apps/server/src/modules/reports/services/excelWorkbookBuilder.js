import ExcelJS from 'exceljs';

export async function createExcelReport(sources) {
  const workbook = new ExcelJS.Workbook();
  const metrics = calculateMetrics(sources.data);
  addGlobalSheets(workbook, metrics);
  addCourseSheet(workbook, metrics.courses);
  addDetailSheet(workbook, sources.data);
  addOperationalSheets(workbook, sources);
  return workbook.xlsx.writeBuffer();
}

function calculateMetrics(data) {
  const metrics = {
    total: data.length,
    approved: 0,
    pending: 0,
    edited: 0,
    rejected: 0,
    teacherRating: { sum: 0, count: 0 },
    studentRating: { sum: 0, count: 0 },
    usefulness: { useful: 0, count: 0 },
    courses: new Map()
  };
  for (const row of data) updateMetrics(metrics, row);
  return metrics;
}

function translateStatus(status) {
  const map = { 'PENDIENTE': 'Pending', 'APROBADO': 'Approved', 'EDITADO': 'Edited', 'RECHAZADO': 'Rejected', 'ENVIADO': 'Sent' };
  // eslint-disable-next-line security/detect-object-injection
  return map[status] || status;
}

function updateMetrics(metrics, row) {
  const status = row.estado || 'PENDIENTE';
  if (status === 'APROBADO' || status === 'ENVIADO') metrics.approved += 1;
  else if (status === 'PENDIENTE') metrics.pending += 1;
  else if (status === 'EDITADO') metrics.edited += 1;
  else if (status === 'RECHAZADO') metrics.rejected += 1;
  addRating(metrics.teacherRating, row.calificacion_teacher);
  addRating(metrics.studentRating, row.calificacion_student);
  if (row.es_util !== null && row.es_util !== undefined) {
    metrics.usefulness.count += 1;
    if (row.es_util) metrics.usefulness.useful += 1;
  }
  updateCourseMetrics(metrics.courses, row, status);
}

function addRating(target, value) {
  if (value === null || value === undefined || value === '') return;
  target.sum += Number(value);
  target.count += 1;
}

function updateCourseMetrics(courses, row, status) {
  const key = row.curso_id;
  if (!courses.has(key)) {
    courses.set(key, {
      name: row.nombre_curso || `Course ${key}`,
      total: 0,
      approved: 0,
      teacherRating: { sum: 0, count: 0 },
      studentRating: { sum: 0, count: 0 }
    });
  }
  const course = courses.get(key);
  course.total += 1;
  if (status === 'APROBADO') course.approved += 1;
  addRating(course.teacherRating, row.calificacion_teacher);
  addRating(course.studentRating, row.calificacion_student);
}

function addGlobalSheets(workbook, metrics) {
  const teacherAverage = formatAverage(metrics.teacherRating);
  const studentAverage = formatAverage(metrics.studentRating);
  addRowsSheet(workbook, 'Global Metrics', metricColumns(), [
    ['Total Feedbacks Generated', metrics.total],
    ['Global Approval Rate', formatPercentage(metrics.approved, metrics.total)],
    ['Average Teacher Rating', withStars(teacherAverage)],
    ['Average Student Rating', withStars(studentAverage)],
    ['---', '---'], ['Total Approved', metrics.approved], ['Total Edited', metrics.edited],
    ['Total Pending', metrics.pending], ['Total Rejected', metrics.rejected]
  ].map(([metrica, valor]) => ({ metrica, valor })));
  addRowsSheet(workbook, 'Feedback Usefulness', metricColumns('Usefulness Metric (Students)'), [
    ['Total Usefulness Evaluations', metrics.usefulness.count],
    ['Total Feedbacks Considered Useful', metrics.usefulness.useful],
    ['Usefulness Percentage', formatPercentage(metrics.usefulness.useful, metrics.usefulness.count)],
    ['Average Rating (1-5 Scale)', withStars(studentAverage)]
  ].map(([metrica, valor]) => ({ metrica, valor })));
}

function addCourseSheet(workbook, courses) {
  const columns = [
    column('Course Name', 'curso', 35), column('Total Feedbacks', 'total', 15),
    column('Approved', 'aprobados', 15), column('Teacher Rating', 'valProf', 20),
    column('Student Rating', 'valEst', 20)
  ];
  const rows = [...courses.values()].map((course) => ({
    curso: course.name, total: course.total, aprobados: course.approved,
    valProf: withStars(formatAverage(course.teacherRating)),
    valEst: withStars(formatAverage(course.studentRating))
  }));
  addRowsSheet(workbook, 'Course Metrics', columns, rows);
}

function addDetailSheet(workbook, data) {
  const columns = [
    column('Generation Date', 'fecha_generacion', 25), column('Course Name', 'curso', 30),
    column('Assignment Name', 'asignacion', 30), column('Student Name', 'student', 30),
    column('Teacher ID', 'teacher_id', 15), column('Status', 'estado', 15),
    column('Original Grade', 'nota_canvas', 15), column('AI Grade', 'nota_chile', 15),
    column('Was Useful? (Yes/No)', 'es_util', 20), column('Teacher Rating', 'val_prof', 20),
    column('Student Rating', 'val_est', 20)
  ];
  const rows = data.map((row) => ({
    fecha_generacion: formatDate(row.fecha_generacion), curso: row.nombre_curso || `Course ${row.curso_id}`,
    asignacion: row.nombre_tarea || `Assignment ${row.tarea_id}`, student: row.nombre_student || `Student ${row.student_id}`,
    teacher_id: row.profesor_id || 'N/A', estado: translateStatus(row.estado || 'PENDIENTE'), nota_canvas: valueOrNa(row.nota_canvas),
    nota_chile: valueOrNa(row.nota_chile), es_util: row.es_util == null ? 'N/A' : row.es_util ? 'Yes' : 'No',
    val_prof: withStars(row.calificacion_teacher), val_est: withStars(row.calificacion_student)
  }));
  addRowsSheet(workbook, 'Historical Detail', columns, rows);
}

function addOperationalSheets(workbook, sources) {
  addRecordsSheet(workbook, 'Audit (Critical)', auditSheetConfig(), sources.auditLogs);
  addRecordsSheet(workbook, 'Deployment Metrics', migrationSheetConfig(), sources.migrationLogs);
  addRecordsSheet(workbook, 'System Notifications', notificationSheetConfig(), sources.systemNotifications);
  addRecordsSheet(workbook, 'Template History', templateSheetConfig(), sources.templatesHistory);
}

function addRecordsSheet(workbook, title, config, records = []) {
  const rows = records.length ? records.map(config.map) : [config.empty];
  addRowsSheet(workbook, title, config.columns, rows);
}

function auditSheetConfig() {
  return {
    columns: [column('Date', 'fecha', 25), column('User ID', 'usuario', 20), column('Action / Event Type', 'accion', 45), column('Detail and IP', 'detalle', 60)],
    map: (item) => ({ fecha: formatDate(item.fecha), usuario: item.usuario_id || 'SYSTEM', accion: item.accion, detalle: `${item.detalle || 'No details'} | IP: ${item.ip_address || 'N/A'}` }),
    empty: { fecha: 'N/A', usuario: 'N/A', accion: 'No security incidents detected in this period.', detalle: '---' }
  };
}

function migrationSheetConfig() {
  return {
    columns: [column('Execution Date', 'fecha', 25), column('Version / File', 'version', 40), column('Status', 'estado', 20), column('Detail / Logs', 'logs', 80)],
    map: (item) => ({ fecha: formatDate(item.ejecutado_en), version: item.version, estado: item.status, logs: item.logs || 'No details' }),
    empty: { fecha: 'N/A', version: 'N/A', estado: 'N/A', logs: 'No migration records available.' }
  };
}

function notificationSheetConfig() {
  return {
    columns: [column('Teacher ID', 'teacher_id', 20), column('Error Type', 'tipo_error', 30), column('Error Message', 'mensaje_error', 60), column('Detection Date', 'creado_en', 25), column('Resolved', 'resuelto', 15)],
    map: (item) => ({ teacher_id: item.profesor_id || 'N/A', tipo_error: item.tipo_error || 'N/A', mensaje_error: item.mensaje_error || 'No message', creado_en: formatDate(item.creado_en), resuelto: item.resuelto ? 'Yes' : 'No' }),
    empty: { teacher_id: 'N/A', tipo_error: 'N/A', mensaje_error: 'No system notifications.', creado_en: 'N/A', resuelto: 'N/A' }
  };
}

function templateSheetConfig() {
  return {
    columns: [column('Template Name', 'nombre', 35), column('Author (Teacher ID)', 'autor', 25), column('Creation Date', 'fecha_creacion', 25), column('Last Modified', 'ultima_modificacion', 25), column('Usage Frequency', 'frecuencia_uso', 20)],
    map: (item) => ({ nombre: item.nombre || 'No name', autor: item.autor || 'System (Global)', fecha_creacion: formatDate(item.fecha_creacion), ultima_modificacion: formatDate(item.ultima_modificacion), frecuencia_uso: item.frecuencia_uso || 0 }),
    empty: { nombre: 'No templates registered.', autor: 'N/A', fecha_creacion: 'N/A', ultima_modificacion: 'N/A', frecuencia_uso: 0 }
  };
}

function addRowsSheet(workbook, title, columns, rows) {
  const sheet = workbook.addWorksheet(title);
  sheet.columns = columns;
  rows.forEach((row) => sheet.addRow(row));
  styleHeader(sheet);
}

function styleHeader(sheet) {
  sheet.getRow(1).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0374B5' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
}

function column(header, key, width) { return { header, key, width }; }
function metricColumns(firstHeader = 'Metric') { return [column(firstHeader, 'metrica', 45), column('Value', 'valor', 20)]; }
function formatDate(value) { return value ? new Date(value).toLocaleString() : 'N/A'; }
function valueOrNa(value) { return value === null || value === undefined ? 'N/A' : value; }
function formatAverage({ sum, count }) { return count ? (sum / count).toFixed(1) : 'N/A'; }
function formatPercentage(value, total) { return total ? `${((value / total) * 100).toFixed(1)}%` : 'N/A'; }
function withStars(value) { return value === 'N/A' ? value : `${value} ⭐`; }
