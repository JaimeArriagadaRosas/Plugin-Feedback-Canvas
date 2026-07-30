import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// __dirname = apps/server/src/services/config
const ENV_PATH = path.resolve(__dirname, '../../../../../../.env');

class ConfigManager {
  constructor() {
    this.envCache = {};
    this.reload();
  }

  /**
   * Reloads the environment variables from the .env file into memory.
   * This is meant to be called whenever the orchestrator updates the .env file,
   * enabling hot-reloading without restarting the Node process.
   */
  reload() {
    try {
      if (fs.existsSync(ENV_PATH)) {
        const content = fs.readFileSync(ENV_PATH, 'utf-8');
        const parsed = {};
        content.split('\n').forEach(line => {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const separatorIdx = trimmed.indexOf('=');
            if (separatorIdx !== -1) {
              const key = trimmed.substring(0, separatorIdx).trim();
              const val = trimmed.substring(separatorIdx + 1).trim();
              parsed[key] = val;
            }
          }
        });
        this.envCache = parsed;
      }
    } catch (e) {
      console.warn(`[ConfigManager] No se pudo recargar el .env: ${e.message}`);
    }
  }

  /**
   * Gets a configuration value. Follows this priority:
   * 1. The in-memory cache of the .env file (supports hot-reloading)
   * 2. process.env (for variables injected by Docker/OS)
   * 3. A fallback default value
   */
  get(key, defaultValue = null) {
    if (this.envCache[key] !== undefined) {
      return this.envCache[key];
    }
    if (process.env[key] !== undefined) {
      return process.env[key];
    }
    return defaultValue;
  }

  getLtiClientId() {
    // Retornamos estrictamente LTI_CLIENT_ID
    return this.get('LTI_CLIENT_ID', '10000000000001');
  }

  getCanvasBaseUrl() {
    return this.get('CANVAS_BASE_URL', this.get('VITE_CANVAS_BASE_URL', 'https://canvas.instructure.com'));
  }

  getCanvasIssuer() {
    return this.get('CANVAS_ISSUER', this.getCanvasBaseUrl());
  }

  getLtiDeploymentIds() {
    const ids = this.get('LTI_DEPLOYMENT_IDS', '');
    return ids.split(',').map(s => s.trim()).filter(Boolean);
  }
}

const configManager = new ConfigManager();
export default configManager;
