import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nowIso } from '../../utils/datetime.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPORT_DIR = path.resolve(__dirname, '..', 'report');

function ensureReportDir() {
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }
}

export function generateReport(results) {
  ensureReportDir();

  const summary = {
    timestamp: nowIso(),
    total: results.total,
    passed: results.passed,
    failed: results.failed,
    skipped: results.skipped || 0,
    duration: results.duration || 0,
    failures: results.failures || []
  };

  const reportPath = path.join(REPORT_DIR, 'latest.json');
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2), 'utf8');

  return summary;
}

export function printSummary(summary) {
  console.log('\n');
  console.log('  REPORTE DE VALIDACIN DE CAJA NEGRA');
  console.log('');
  console.log(`  Total tests:    ${summary.total}`);
  console.log(`  Pasados:        ${summary.passed}`);
  console.log(`  Fallidos:       ${summary.failed}`);
  console.log(`  Omitidos:       ${summary.skipped}`);
  console.log(`  Duracin:       ${summary.duration}ms`);
  console.log('');

  if (summary.failures.length > 0) {
    console.log('\n  FALLOS:');
    summary.failures.forEach((f, i) => {
      console.log(`  ${i + 1}. ${f.name || f.test || 'Test desconocido'}`);
      console.log(`     ${f.message || f.error || 'Sin mensaje'}`);
    });
    console.log('');
  }
}
