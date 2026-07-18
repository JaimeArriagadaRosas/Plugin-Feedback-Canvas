import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PLUGIN_DIR = path.resolve(__dirname, '../../../../..');
const ENV_PATH = path.join(PLUGIN_DIR, '.env');

describe('Regresin  Error 6: Variables de entorno redundantes', () => {
  beforeEach(() => {
    // Backup real para restaurar el .env del proyecto tras el test (antes
    // solo lo reescribía, corriendo el riesgo de dejarlo corrupto si fallaba).
    fs.copyFileSync(ENV_PATH, ENV_PATH + '.bak');
  });

  afterEach(() => {
    if (fs.existsSync(ENV_PATH + '.bak')) {
      fs.renameSync(ENV_PATH + '.bak', ENV_PATH);
    }
  });

  it('writeEnvOverrides elimina variables obsoletas', async () => {
    const { writeEnvOverrides } = await import('../../orchestration/envWriter.js');
    writeEnvOverrides(PLUGIN_DIR, '3', true, 'admin');

    const content = fs.readFileSync(ENV_PATH, 'utf8');
    const lines = content.split('\n');

    const hasObsolete = lines.some(l =>
      l.startsWith('MOCK_USER_ROLE=') ||
      l.startsWith('VITE_USE_MOCK_DATA=') ||
      l.startsWith('STARTUP_MODE=')
    );

    expect(hasObsolete).toBe(false);
  });

  it('writeEnvOverrides elimina STARTUP_MODE (variable obsoleta, no la reescribe)', async () => {
    const { writeEnvOverrides } = await import('../../orchestration/envWriter.js');
    writeEnvOverrides(PLUGIN_DIR, '3', true, 'admin');

    const content = fs.readFileSync(ENV_PATH, 'utf8');
    const matches = content.match(/^STARTUP_MODE=/gm);
    expect(matches).toBeNull();
  });
});
