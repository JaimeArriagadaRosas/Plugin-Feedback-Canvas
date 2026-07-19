import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';
import { runCommand } from '../orchestration/boot/setup/utils/Runner.js';
import { generateLtiRubyScript } from './LtiRubyScriptTemplate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CANVAS_DIR = path.resolve(__dirname, '../../../../../canvas-lms-master');

export class DockerLtiConfigurator {
  static async runDockerCommand(args, envs = {}) {
    return runCommand('docker', args, { cwd: CANVAS_DIR, env: { ...process.env, ...envs } });
  }

  static async cleanDatabase() {
    console.log(`${pc.yellow('[LTI Installer]')} Ejecutando limpiador de base de datos...`);
    const cleanerScript = `
      puts "[Canvas Cache Cleaner] Iniciando limpieza profunda de BD..."
      tools_to_delete = ContextExternalTool.where(name: ['Feedback', 'Test LTI', 'Prueba Local'])
      tools_to_delete += ContextExternalTool.where("url LIKE '%localhost:3000%'")
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
    const cleanerProc = await this.runDockerCommand(['compose', 'exec', '-T', '-e', 'DISABLE_SPRING=1', 'web', 'bundle', 'exec', 'rails', 'runner', cleanerScript]);
    if (!cleanerProc.success) {
      throw new Error(`Limpieza de BD falló: ${cleanerProc.err}`);
    }
    console.log(`${pc.green('[LTI Installer]')} Limpieza de BD completada.`);
  }

  static async injectLtiTool(ltiJsonPath) {
    const ltiJson = await fs.readFile(ltiJsonPath, 'utf-8');
    const pluginUrl = process.env.VITE_BACKEND_URL || 'https://localhost:3000';
    const internalPluginUrl = process.env.INTERNAL_PLUGIN_URL || pluginUrl.replace('localhost', 'host.docker.internal');
    const globalJsUrl = `${pluginUrl}/api/canvas/canvas-logs.js`;
    const canvasDomain = process.env.CANVAS_DOMAIN || 'localhost:8443';

    console.log(`${pc.cyan('[LTI Installer]')} Inyectando script LTI 1.3 en el contenedor de Canvas...`);
    
    const rubyScript = generateLtiRubyScript({ ltiJson, pluginUrl, internalPluginUrl, canvasDomain, globalJsUrl });

    const installProc = await this.runDockerCommand(['compose', 'exec', '-T', '-e', 'DISABLE_SPRING=1', 'web', 'bundle', 'exec', 'rails', 'runner', rubyScript]);
    
    if (installProc.success && installProc.out.includes('SUCCESS')) {
      const clientId = await this._updateClientId(installProc.out);
      console.log(`${pc.green('[LTI Installer]')} Plugin instalado nativamente en Account.default.`);
      if (installProc.out.includes('GLOBAL_JS_UPDATED')) {
        await this._recompileBrandConfigs();
      }
      return clientId;
    } else {
      throw new Error(`Fallo en rails runner. Stderr: ${installProc.err}\nStdout: ${installProc.out}`);
    }
  }

  static async _updateClientId(output) {
    const match = output.match(/LTI_CLIENT_ID:(\d+)/);
    if (match && match[1]) {
      const newClientId = match[1];
      process.env.LTI_CLIENT_ID = newClientId;
      console.log(`${pc.green('[LTI Installer]')} LTI_CLIENT_ID detectado: ${newClientId}`);
      return newClientId;
    }
    return null;
  }

  static async _recompileBrandConfigs() {
    console.log(`${pc.yellow('[LTI Installer]')} JavaScript Global actualizado. Compilando BrandConfigs (esto puede tomar 1 minuto)...`);
    await this.runDockerCommand(['compose', 'exec', '-T', 'web', 'bundle', 'exec', 'rake', 'brand_configs:generate_and_upload_all']);
    console.log(`${pc.green('[LTI Installer]')} BrandConfigs recompilados.`);
  }
}
