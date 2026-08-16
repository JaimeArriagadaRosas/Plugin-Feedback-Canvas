import PDFDocument from 'pdfkit';

const COLORS = { blue: '#0374B5', text: '#333333', light: '#F5F5F5', line: '#E0E0E0' };

export function createPdfReport({ data, auditLogs, migrationLogs }) {
  return new Promise((resolve, reject) => {
    try {
      const document = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers = [];
      document.on('data', (chunk) => buffers.push(chunk));
      document.on('end', () => resolve(Buffer.concat(buffers)));
      renderReport(document, calculateMetrics(data), auditLogs, migrationLogs);
      document.end();
    } catch (error) {
      reject(error);
    }
  });
}

function calculateMetrics(data) {
  const metrics = {
    total: data.length, approved: 0, pending: 0, edited: 0, rejected: 0,
    teacherRatings: { sum: 0, count: 0 }, studentRatings: { sum: 0, count: 0 },
    stars: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, courses: new Map()
  };
  data.forEach((row) => updateMetrics(metrics, row));
  return metrics;
}

function updateMetrics(metrics, row) {
  const status = row.estado || 'PENDIENTE';
  if (status === 'APROBADO') metrics.approved += 1;
  else if (status === 'PENDIENTE') metrics.pending += 1;
  else if (status === 'EDITADO') metrics.edited += 1;
  else if (status === 'RECHAZADO') metrics.rejected += 1;
  addRating(metrics.teacherRatings, row.calificacion_teacher);
  addRating(metrics.studentRatings, row.calificacion_student, metrics.stars);
  const key = row.curso_id;
  if (!metrics.courses.has(key)) metrics.courses.set(key, { name: row.nombre_curso || `Course ${key}`, total: 0, approved: 0 });
  const course = metrics.courses.get(key);
  course.total += 1;
  if (status === 'APROBADO') course.approved += 1;
}

function addRating(ratings, value, stars) {
  if (value === null || value === undefined || value === '') return;
  const numeric = Number(value);
  ratings.sum += numeric;
  ratings.count += 1;
  // eslint-disable-next-line security/detect-object-injection
  if (stars && Number.isInteger(numeric) && stars[numeric] !== undefined) stars[numeric] += 1;
}

function renderReport(document, metrics, auditLogs, migrationLogs) {
  drawDocumentHeader(document, 'AI Dashboard - Global Feedback', `Generated: ${new Date().toLocaleString()}`);
  drawDashboard(document, metrics);
  drawAuditAppendix(document, auditLogs);
  drawMigrationAppendix(document, migrationLogs);
}

function drawDocumentHeader(document, title, subtitle) {
  document.rect(0, 0, document.page.width, 100).fill(COLORS.blue);
  document.fillColor('white').fontSize(24).text(title, 0, 35, { align: 'center' });
  document.fontSize(12).text(subtitle, 0, 65, { align: 'center' });
  document.y = 120;
}

function drawDashboard(document, metrics) {
  const teacherAverage = average(metrics.teacherRatings);
  const studentAverage = average(metrics.studentRatings);
  const approvalRate = percentage(metrics.approved, metrics.total);
  drawKpiCards(document, metrics.total, approvalRate, teacherAverage, studentAverage);
  drawStateDistribution(document, metrics);
  drawRatingHistogram(document, metrics.stars);
  drawCourseSummary(document, metrics.courses);
}

function drawKpiCards(document, total, approvalRate, teacherAverage, studentAverage) {
  const y = document.y;
  const cards = [
    ['Total Feedbacks', String(total)], ['Approval Rate', approvalRate],
    ['Teacher Rating', withStars(teacherAverage)], ['Student Rating', withStars(studentAverage)]
  ];
  cards.forEach(([title, value], index) => drawKpi(document, 50 + index * 120, y, title, value));
  document.y = y + 110;
}

function drawKpi(document, x, y, title, value) {
  document.rect(x, y, 110, 80).fill(COLORS.light).stroke(COLORS.line);
  document.fillColor(COLORS.blue).fontSize(10).text(title, x + 5, y + 15, { width: 100, align: 'center' });
  document.fillColor(COLORS.text).fontSize(20).text(value, x + 5, y + 40, { width: 100, align: 'center' });
}

function drawStateDistribution(document, metrics) {
  drawSectionTitle(document, 'State Distribution');
  const states = [['APPROVED', metrics.approved], ['EDITED', metrics.edited], ['PENDING', metrics.pending], ['REJECTED', metrics.rejected]];
  states.forEach(([name, count]) => {
    document.fillColor(COLORS.text).fontSize(12).text(name, 50, document.y);
    document.text(String(count), 200, document.y);
    document.y += 20;
  });
}

function drawRatingHistogram(document, stars) {
  document.y += 20;
  drawSectionTitle(document, 'Rating Histogram (Students)');
  const max = Math.max(...Object.values(stars), 1);
  const baseY = document.y;
  [5, 4, 3, 2, 1].forEach((star, index) => {
    // eslint-disable-next-line security/detect-object-injection
    const count = stars[star];
    const y = baseY + index * 25;
    const width = (count / max) * 300;
    document.fillColor(COLORS.text).fontSize(10).text(`${star} ⭐`, 50, y + 3);
    if (width > 0) document.rect(90, y, width, 15).fill(COLORS.blue);
    document.fillColor(COLORS.text).text(String(count), 100 + width, y + 3);
  });
  document.y = baseY + 140;
}

function drawCourseSummary(document, courses) {
  ensureSpace(document, 150);
  drawSectionTitle(document, 'Course Summary (Top 10)');
  document.fillColor('#777777').fontSize(10);
  document.text('COURSE', 50, document.y);
  document.text('TOTAL', 350, document.y);
  document.text('APPROVED', 450, document.y);
  document.y += 15;
  [...courses.values()].sort((a, b) => b.total - a.total).slice(0, 10).forEach((course) => {
    const name = course.name.length > 40 ? `${course.name.slice(0, 37)}...` : course.name;
    document.fillColor(COLORS.text).fontSize(10).text(name, 50, document.y);
    document.text(String(course.total), 350, document.y);
    document.text(String(course.approved), 450, document.y);
    document.y += 15;
    document.moveTo(50, document.y).lineTo(545, document.y).stroke(COLORS.line);
    document.y += 5;
  });
}

function drawAuditAppendix(document, auditLogs = []) {
  document.addPage();
  drawDocumentHeader(document, 'Appendix: Security Alerts', 'Recent Critical Incidents');
  drawSectionTitle(document, 'Security Alerts Summary');
  if (!auditLogs.length) {
    document.fillColor('#137333').fontSize(12).text('No critical security incidents detected in the reported period.', 50, document.y);
    return;
  }
  document.fillColor('#d32f2f').fontSize(12).text(`${auditLogs.length} critical/failed incidents detected in recent logs.`, 50, document.y);
  document.y += 20;
  drawTableHeader(document, ['DATE', 'USER', 'ACTION', 'DETAIL / IP'], [50, 150, 230, 350]);
  auditLogs.slice(0, 15).forEach((log) => drawAuditRow(document, log));
}

function drawAuditRow(document, log) {
  const y = document.y;
  const values = [formatDate(log.fecha), log.usuario_id || 'SYSTEM', (log.accion || 'N/A').slice(0, 40), `${log.detalle || ''} | IP: ${log.ip_address || 'N/A'}`.slice(0, 60)];
  drawTableRow(document, values, [50, 150, 230, 350], [90, 70, 110, 195]);
  document.y = Math.max(document.y, y + 15);
}

function drawMigrationAppendix(document, migrationLogs = []) {
  document.addPage();
  drawDocumentHeader(document, 'Appendix: Deployment Metrics', 'Migration History');
  drawSectionTitle(document, 'Database Migration Log');
  if (!migrationLogs.length) {
    document.fillColor('#777777').fontSize(12).text('No migration records available.', 50, document.y);
    return;
  }
  drawTableHeader(document, ['DATE', 'VERSION', 'STATUS', 'LOGS / DETAIL'], [50, 140, 280, 340]);
  migrationLogs.slice(0, 20).forEach((log) => drawMigrationRow(document, log));
}

function drawMigrationRow(document, log) {
  const status = log.status || 'N/A';
  const y = document.y;
  document.fillColor(status === 'FAILED' ? '#d32f2f' : status === 'SUCCESS' ? '#137333' : COLORS.text);
  drawTableRow(document, [formatDate(log.ejecutado_en), String(log.version || 'N/A').slice(0, 35), status, String(log.logs || 'No details').slice(0, 60)], [50, 140, 280, 340], [90, 140, 60, 205]);
  document.y = Math.max(document.y, y + 15);
  ensureSpace(document, 50);
}

function drawSectionTitle(document, title) {
  document.fillColor(COLORS.blue).fontSize(16).text(title, 50, document.y);
  document.moveTo(50, document.y + 5).lineTo(545, document.y + 5).stroke(COLORS.blue);
  document.y += 20;
}

function drawTableHeader(document, labels, positions) {
  document.fillColor('#777777').fontSize(9);
  // eslint-disable-next-line security/detect-object-injection
  labels.forEach((label, index) => document.text(label, positions[index], document.y));
  document.y += 15;
}

function drawTableRow(document, values, positions, widths) {
  const y = document.y;
  document.fillColor(COLORS.text).fontSize(9);
  // eslint-disable-next-line security/detect-object-injection
  values.forEach((value, index) => document.text(value, positions[index], y, { width: widths[index] }));
  document.y = Math.max(document.y, y + 15);
  document.moveTo(50, document.y).lineTo(545, document.y).stroke('#EEEEEE');
  document.y += 5;
}

function ensureSpace(document, space) {
  if (document.y > document.page.height - space) {
    document.addPage();
    document.y = 50;
  }
}

function average({ sum, count }) { return count ? (sum / count).toFixed(1) : 'N/A'; }
function percentage(value, total) { return total ? `${((value / total) * 100).toFixed(1)}%` : '0.0%'; }
function withStars(value) { return value === 'N/A' ? value : `${value} ⭐`; }
function formatDate(value) { return value ? new Date(value).toLocaleString() : 'N/A'; }
