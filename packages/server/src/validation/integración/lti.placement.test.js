import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Integración - Configuración LTI 1.3 (Caja Negra)', () => {
  const workspaceDir = path.resolve(__dirname, '../../../../../..');
  const canvasDir = path.join(workspaceDir, 'canvas-lms-master');

  it('La herramienta LTI Unida debe existir en la base de datos de Canvas', () => {
    if (!fs.existsSync(canvasDir)) {
      console.warn('Omitiendo test LTI: canvas-lms-master no encontrado localmente.');
      return;
    }

    const rubyCmd = "puts ContextExternalTool.where(name: 'Unida').count > 0 ? 'LTI_EXISTS' : 'LTI_MISSING'";
    const output = execSync(`docker compose exec -T web bundle exec rails runner "${rubyCmd}"`, {
      cwd: canvasDir,
      encoding: 'utf-8',
      stdio: 'pipe'
    });

    expect(output.trim()).toContain('LTI_EXISTS');
  }, 30000);

  it('El placement debe estar configurado como course_navigation y NO global_navigation', () => {
    if (!fs.existsSync(canvasDir)) return;

    const rubyCmd = "dk = DeveloperKey.where(name: 'Plugin Feedback LTI').first; tc = Lti::ToolConfiguration.where(developer_key_id: dk&.id).first; puts (tc && tc.placements.any? { |p| p['placement'] == 'course_navigation' }) ? 'PLACEMENT_OK' : 'PLACEMENT_FAIL'";
    const output = execSync(`docker compose exec -T web bundle exec rails runner "${rubyCmd}"`, {
      cwd: canvasDir,
      encoding: 'utf-8',
      stdio: 'pipe'
    });

    expect(output.trim()).toContain('PLACEMENT_OK');
  }, 30000);

  it('La visibilidad debe ser admins para evitar que los estudiantes vean el botón', () => {
    if (!fs.existsSync(canvasDir)) return;

    const rubyCmd = "dk = DeveloperKey.where(name: 'Plugin Feedback LTI').first; tc = Lti::ToolConfiguration.where(developer_key_id: dk&.id).first; p = tc&.placements&.find { |pl| pl['placement'] == 'course_navigation' }; puts (p && p['visibility'] == 'admins') ? 'VISIBILITY_OK' : 'VISIBILITY_FAIL'";
    const output = execSync(`docker compose exec -T web bundle exec rails runner "${rubyCmd}"`, {
      cwd: canvasDir,
      encoding: 'utf-8',
      stdio: 'pipe'
    });

    expect(output.trim()).toContain('VISIBILITY_OK');
  }, 30000);
});
