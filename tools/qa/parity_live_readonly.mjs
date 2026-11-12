// Read-only inspection of the user's already running Canvas. No service actions.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { diagnoseCanvasReadOnly } from '../../apps/installer/src/diagnostics/CanvasReadOnlyDiagnosis.js';

const flags = ['QA_ALLOW_LIVE_CANVAS_READONLY', 'PLUGIN_TEST_MODE', 'PLUGIN_QA_NO_BROWSER'];
if (flags.some(name => process.env[name] !== 'true')) {
  throw new Error('Explicit read-only, headless QA authorization required');
}
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const expectedRepo = '/home/jaime/proyectos/Plugin-Feedback-Canvas';
if (repo !== expectedRepo) throw new Error('Only the current English repository is authorized');
const canvasDir = path.resolve(repo, '../canvas-lms-master');
if (!fs.existsSync(path.join(canvasDir, 'docker-compose.yml'))) {
  throw new Error('Canvas Compose file is unavailable; do not start services');
}
const evidenceDir = '/mnt/d/Documentos/MDL/Informatico/Plugin-Feedback-Parity-QA/reports';
if (!fs.realpathSync(evidenceDir).startsWith('/mnt/d/Documentos/MDL/Informatico/Plugin-Feedback-Parity-QA/')) {
  throw new Error('Evidence must stay on the D drive');
}
const snapshot = () => execFileSync('docker', ['ps', '-a', '--format', '{{.ID}}|{{.Names}}|{{.State}}'], {
  timeout: 12000, encoding: 'utf8'
}).split('\n').filter(Boolean).sort();
const before = snapshot();
const { report, reportPath } = await diagnoseCanvasReadOnly({ pluginDir: repo, canvasDir });
const after = snapshot();
const noServiceChange = JSON.stringify(before) === JSON.stringify(after);
const output = {
  schema: 'qa-live-canvas-readonly-v1',
  mode: 'read-only-observation',
  generatedAt: new Date().toISOString(),
  diagnosticStatus: report.status,
  checkCount: report.checks.length,
  checkCodesAndLevels: report.checks.map(({code, level}) => ({code, level})),
  reportWritten: Boolean(reportPath),
  noServiceChange,
  databaseWritesPerformed: false,
  recoveryAttempted: false,
  interpretationProvided: Boolean(report.support?.title && report.support?.nextStep),
  fullCanvasRailsLoginSimulated: false,
};
const p = path.join(evidenceDir, 'english-active-canvas-readonly.json');
fs.writeFileSync(p, JSON.stringify(output, null, 2)+'\n', { mode:0o600 });
console.log('QA_LIVE_CANVAS_READONLY', output.diagnosticStatus,
  'checks', output.checkCount, 'services_unchanged', noServiceChange,
  'report_saved', output.reportWritten);
console.log('QA_LIVE_CANVAS_EVIDENCE', p);
if (!noServiceChange || !output.reportWritten || !output.interpretationProvided)
  process.exitCode = 2;
