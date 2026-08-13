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

function updateMetrics(metrics, row) {
  const status = row.estado || 'PENDIENTE';
  if (status === 'APROBADO') metrics.approved += 1;
  else if (status === 'PENDIENTE') metrics.pending += 1;
  else if (status === 'EDITADO') metrics.edited += 1;
  else if (status === 'RECHAZADO') metrics.rejected += 1;
  addRating(metrics.teacherRating, row.calificacion_profesor);
  addRating(metrics.studentRating, row.calificacion_estudiante);
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
      name: row.nombre_curso || `Curso ${key}`,
      total: 0,
      approved: 0,
      teacherRating: { sum: 0, count: 0 },
      studentRating: { sum: 0, count: 0 }
    });
  }
  const course = courses.get(key);
  course.total += 1;
  if (status === 'APROBADO') course.approved += 1;
  addRating(course.teacherRating, row.calificacion_profesor);
  addRating(course.studentRating, row.calificacion_estudiante);
}

function addGlobalSheets(workbook, metrics) {
  const teacherAverage = formatAverage(metrics.teacherRating);
  const studentAverage = formatAverage(metrics.studentRating);
  addRowsSheet(workbook, 'Métricas Globales', metricColumns(), [
    ['Total de Feedbacks Generados', metrics.total],
    ['Tasa de Aprobación Global', formatPercentage(metrics.approved, metrics.total)],
    ['Promedio Valoración Profesores', withStars(teacherAverage)],
    ['Promedio Valoración Estudiantes', withStars(studentAverage)],
    ['---', '---'], ['Total Aprobados', metrics.approved], ['Total Editados', metrics.edited],
    ['Total Pendientes', metrics.pending], ['Total Rechazados', metrics.rejected]
  ].map(([metrica, valor]) => ({ metrica, valor })));
  addRowsSheet(workbook, 'Utilidad del Feedback', metricColumns('Métrica de Utilidad (Estudiantes)'), [
    ['Total de Evaluaciones de Utilidad', metrics.usefulness.count],
    ['Total de Feedbacks Considerados Útiles', metrics.usefulness.useful],
    ['Porcentaje de Utilidad', formatPercentage(metrics.usefulness.useful, metrics.usefulness.count)],
    ['Promedio Valoración (Escala 1-5)', withStars(studentAverage)]
  ].map(([metrica, valor]) => ({ metrica, valor })));
}

function addCourseSheet(workbook, courses) {
  const columns = [
    column('Nombre Curso', 'curso', 35), column('Total Feedbacks', 'total', 15),
    column('Aprobados', 'aprobados', 15), column('Valoración Profesor', 'valProf', 20),
    column('Valoración Estudiante', 'valEst', 20)
  ];
  const rows = [...courses.values()].map((course) => ({
    curso: course.name, total: course.total, aprobados: course.approved,
    valProf: withStars(formatAverage(course.teacherRating)),
    valEst: withStars(formatAverage(course.studentRating))
  }));
  addRowsSheet(workbook, 'Métricas por Curso', columns, rows);
}

function addDetailSheet(workbook, data) {
  const columns = [
    column('Fecha de Generación', 'fecha_generacion', 25), column('Nombre Curso', 'curso', 30),
    column('Nombre Tarea', 'asignacion', 30), column('Nombre Estudiante', 'estudiante', 30),
    column('ID Profesor', 'profesor_id', 15), column('Estado', 'estado', 15),
    column('Nota Original', 'nota_canvas', 15), column('Calificación IA', 'nota_chile', 15),
    column('¿Fue Útil? (Sí/No)', 'es_util', 20), column('Valoración Profesor', 'val_prof', 20),
    column('Valoración Estudiante', 'val_est', 20)
  ];
  const rows = data.map((row) => ({
    fecha_generacion: formatDate(row.fecha_generacion), curso: row.nombre_curso || `Curso ${row.curso_id}`,
    asignacion: row.nombre_tarea || `Tarea ${row.tarea_id}`, estudiante: row.nombre_estudiante || `Estudiante ${row.estudiante_id}`,
    profesor_id: row.profesor_id || 'N/A', estado: row.estado || 'PENDIENTE', nota_canvas: valueOrNa(row.nota_canvas),
    nota_chile: valueOrNa(row.nota_chile), es_util: row.es_util == null ? 'N/A' : row.es_util ? 'Sí' : 'No',
    val_prof: withStars(row.calificacion_profesor), val_est: withStars(row.calificacion_estudiante)
  }));
  addRowsSheet(workbook, 'Detalle Histórico', columns, rows);
}

function addOperationalSheets(workbook, sources) {
  addRecordsSheet(workbook, 'Auditoría (Críticos)', auditSheetConfig(), sources.auditLogs);
  addRecordsSheet(workbook, 'Métricas de Despliegue', migrationSheetConfig(), sources.migrationLogs);
  addRecordsSheet(workbook, 'Notificaciones de Sistema', notificationSheetConfig(), sources.systemNotifications);
  addRecordsSheet(workbook, 'Historial de Plantillas', templateSheetConfig(), sources.templatesHistory);
}

function addRecordsSheet(workbook, title, config, records = []) {
  const rows = records.length ? records.map(config.map) : [config.empty];
  addRowsSheet(workbook, title, config.columns, rows);
}

function auditSheetConfig() {
  return {
    columns: [column('Fecha', 'fecha', 25), column('Usuario ID', 'usuario', 20), column('Acción / Tipo de Evento', 'accion', 45), column('Detalle e IP', 'detalle', 60)],
    map: (item) => ({ fecha: formatDate(item.fecha), usuario: item.usuario_id || 'SISTEMA', accion: item.accion, detalle: `${item.detalle || 'Sin detalle'} | IP: ${item.ip_address || 'N/A'}` }),
    empty: { fecha: 'N/A', usuario: 'N/A', accion: 'No se detectaron incidentes de seguridad en este periodo.', detalle: '---' }
  };
}

function migrationSheetConfig() {
  return {
    columns: [column('Fecha de Ejecución', 'fecha', 25), column('Versión / Archivo', 'version', 40), column('Estado', 'estado', 20), column('Detalle / Logs', 'logs', 80)],
    map: (item) => ({ fecha: formatDate(item.ejecutado_en), version: item.version, estado: item.status, logs: item.logs || 'Sin detalle' }),
    empty: { fecha: 'N/A', version: 'N/A', estado: 'N/A', logs: 'No hay registros de migración disponibles.' }
  };
}

function notificationSheetConfig() {
  return {
    columns: [column('ID Profesor', 'profesor_id', 20), column('Tipo Error', 'tipo_error', 30), column('Mensaje Error', 'mensaje_error', 60), column('Fecha Detección', 'creado_en', 25), column('Resuelto', 'resuelto', 15)],
    map: (item) => ({ profesor_id: item.profesor_id || 'N/A', tipo_error: item.tipo_error || 'N/A', mensaje_error: item.mensaje_error || 'Sin mensaje', creado_en: formatDate(item.creado_en), resuelto: item.resuelto ? 'Sí' : 'No' }),
    empty: { profesor_id: 'N/A', tipo_error: 'N/A', mensaje_error: 'No hay notificaciones de sistema.', creado_en: 'N/A', resuelto: 'N/A' }
  };
}

function templateSheetConfig() {
  return {
    columns: [column('Nombre Plantilla', 'nombre', 35), column('Autor (Profesor ID)', 'autor', 25), column('Fecha de Creación', 'fecha_creacion', 25), column('Última Modificación', 'ultima_modificacion', 25), column('Frecuencia de Uso', 'frecuencia_uso', 20)],
    map: (item) => ({ nombre: item.nombre || 'Sin nombre', autor: item.autor || 'Sistema (Global)', fecha_creacion: formatDate(item.fecha_creacion), ultima_modificacion: formatDate(item.ultima_modificacion), frecuencia_uso: item.frecuencia_uso || 0 }),
    empty: { nombre: 'No hay plantillas registradas.', autor: 'N/A', fecha_creacion: 'N/A', ultima_modificacion: 'N/A', frecuencia_uso: 0 }
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
function metricColumns(firstHeader = 'Métrica') { return [column(firstHeader, 'metrica', 45), column('Valor', 'valor', 20)]; }
function formatDate(value) { return value ? new Date(value).toLocaleString() : 'N/A'; }
function valueOrNa(value) { return value === null || value === undefined ? 'N/A' : value; }
function formatAverage({ sum, count }) { return count ? (sum / count).toFixed(1) : 'N/A'; }
function formatPercentage(value, total) { return total ? `${((value / total) * 100).toFixed(1)}%` : 'N/A'; }
function withStars(value) { return value === 'N/A' ? value : `${value} ⭐`; }
