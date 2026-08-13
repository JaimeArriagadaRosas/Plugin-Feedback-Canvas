import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { runCommand } from '../installation/utils/Runner.js';
import { generateLtiRubyScript } from './LtiRubyScriptTemplate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CANVAS_DIR = path.resolve(__dirname, '../../../../../../canvas-lms-master');

export class DockerLtiConfigurator {
  static async runDockerCommand(args, envs = {}, runnerOptions = {}) {
    return runCommand('docker', args, { cwd: CANVAS_DIR, env: { ...process.env, ...envs }, ...runnerOptions });
  }

  static async cleanDatabase(spinner) {
    if (spinner) spinner.update({ text: 'Ejecutando limpiador de base de datos...' });
    const cleanerScript = `
      puts "[Canvas Cache Cleaner] Iniciando limpieza profunda de BD..."
      tools_to_delete = ContextExternalTool.where(name: ['Feedback', 'Test LTI', 'Prueba Local'])
      tools_to_delete = tools_to_delete.to_a + ContextExternalTool.where("url LIKE '%localhost:3000%'").to_a
      if tools_to_delete.any?
        tools_to_delete.uniq.each { |t| t.destroy }
      end
      key = DeveloperKey.where(name: 'Plugin Feedback LTI').first
      if defined?(Rails) && Rails.respond_to?(:cache) && Rails.cache.respond_to?(:delete_matched)
        begin
          Rails.cache.delete_matched(/external_tool/) rescue nil
          Rails.cache.delete_matched(/lti_/i) rescue nil
        rescue => e
        end
      end
      puts "CLEANUP_SUCCESS"
    `;
    const normalizedScript = cleanerScript.replace(/\r\n/g, '\n');
    const cleanerProc = await this.runDockerCommand(
      ['compose', 'exec', '-T', '-e', 'DISABLE_SPRING=1', 'web', 'bundle', 'exec', 'rails', 'runner', '-'],
      {},
      { input: normalizedScript }
    );
    if (!cleanerProc.success) {
      throw new Error(`Limpieza de BD fallo.\nOut: ${cleanerProc.out}\nErr: ${cleanerProc.err}`);
    }
  }

  static async injectLtiTool(ltiJsonPath, spinner) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const ltiJson = await fs.readFile(ltiJsonPath, 'utf-8');
    const pluginUrl = process.env.VITE_BACKEND_URL || 'https://localhost:3000';
    const internalPluginUrl = process.env.INTERNAL_PLUGIN_URL || pluginUrl.replace('localhost', 'host.docker.internal');
    const globalJsUrl = `${pluginUrl}/api/canvas/canvas-logs.js`;
    const canvasDomain = process.env.CANVAS_DOMAIN || 'localhost:8443';

    if (spinner) spinner.update({ text: 'Inyectando script LTI 1.3 en el contenedor de Canvas...' });
    
    const rubyScript = generateLtiRubyScript({ ltiJson, pluginUrl, internalPluginUrl, canvasDomain, globalJsUrl });
    const normalizedScript = rubyScript.replace(/\r\n/g, '\n');

    const installProc = await this.runDockerCommand(
      ['compose', 'exec', '-T', '-e', 'DISABLE_SPRING=1', 'web', 'bundle', 'exec', 'rails', 'runner', '-'],
      {},
      { input: normalizedScript }
    );
    
    if (installProc.success && installProc.out.includes('SUCCESS')) {
      const clientId = await this._updateClientId(installProc.out, spinner);
      if (installProc.out.includes('GLOBAL_JS_UPDATED')) {
        await this._recompileBrandConfigs(spinner);
      }
      return clientId;
    } else {
      throw new Error(`Fallo en rails runner. Stderr: ${installProc.err}\nStdout: ${installProc.out}`);
    }
  }

  static async _updateClientId(output, spinner) {
    const matchId = output.match(/LTI_CLIENT_ID:(\d+)/);
    const matchSecret = output.match(/LTI_CLIENT_SECRET:([^\r\n]+)/);
    
    if (matchId && matchId[1]) {
      const newClientId = matchId[1];
      process.env.LTI_CLIENT_ID = newClientId;
      
      const updates = { LTI_CLIENT_ID: newClientId };
      if (matchSecret && matchSecret[1]) {
        process.env.LTI_CLIENT_SECRET = matchSecret[1].trim();
        updates.LTI_CLIENT_SECRET = process.env.LTI_CLIENT_SECRET;
      }
      
      const pluginDir = path.resolve(__dirname, '../../../../../');
      const { updateEnvVars } = await import('../orchestration/envWriter.js');
      if (spinner) spinner.clear();
      updateEnvVars(pluginDir, updates);
      return newClientId;
    }
    return null;
  }

  static async _recompileBrandConfigs(spinner) {
    if (spinner) spinner.update({ text: 'JavaScript Global actualizado. Compilando BrandConfigs (esto puede tomar 1 minuto)...' });
    await this.runDockerCommand(['compose', 'exec', '-T', 'web', 'bundle', 'exec', 'rake', 'brand_configs:generate_and_upload_all']);
  }
}
