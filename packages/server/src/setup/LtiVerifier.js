import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCommand } from '../orchestration/boot/setup/utils/Runner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CANVAS_DIR = path.resolve(__dirname, '../../../../../canvas-lms-master');

export class LtiVerifier {
  static async isCanvasRunning() {
    try {
      const { success, out } = await runCommand('docker', ['compose', 'ps', '-q', 'web'], { cwd: CANVAS_DIR });
      return success && out.trim().length > 0;
    } catch (e) {
      return false;
    }
  }

  static async checkLtiStatus() {
    const canvasDomain = process.env.CANVAS_DOMAIN || 'localhost:8443';
    
    try {
      const domainYmlPath = path.join(CANVAS_DIR, 'config', 'domain.yml');
      const domainContent = `test:\n  domain: localhost\n\ndevelopment:\n  domain: "${canvasDomain}"\n  ssl: true\n\nproduction:\n  domain: "canvas.example.com"\n  ssl: true`;
      await fs.writeFile(domainYmlPath, domainContent, 'utf-8');
      
      const redisYmlPath = path.join(CANVAS_DIR, 'config', 'redis.yml');
      const redisContent = `development:\n  url: redis://redis:6379\ntest:\n  url: redis://redis:6379/1\nproduction:\n  url: redis://redis:6379\n`;
      await fs.writeFile(redisYmlPath, redisContent, 'utf-8');

      const cacheStoreYmlPath = path.join(CANVAS_DIR, 'config', 'cache_store.yml');
      const cacheStoreContent = `development:\n  cache_store: redis_cache_store\ntest:\n  cache_store: redis_cache_store\nproduction:\n  cache_store: redis_cache_store\n`;
      await fs.writeFile(cacheStoreYmlPath, cacheStoreContent, 'utf-8');
    } catch (err) {}

    const script = `
      puts "[Rails-LtiVerifier] [$] Buscando DeveloperKey 'Plugin Feedback LTI'..."
      dk = DeveloperKey.where(name: 'Plugin Feedback LTI').first
      if dk.nil?
        puts "[Rails-LtiVerifier] [$] DeveloperKey NO ENCONTRADO."
        puts 'LTI_MISSING'
        exit 0
      end

      puts "[Rails-LtiVerifier] [$] DeveloperKey encontrado (ID: #{dk.id}). Verificando ToolConfiguration..."
      tc = dk.tool_configuration

      if tc && tc.persisted?
        puts "[Rails-LtiVerifier] [$] ToolConfiguration encontrado (ID: #{tc.id})."
        has_target = tc.target_link_uri.present? rescue false
        has_redirects = (dk.redirect_uris.to_s.include?('oauth2/canvas/callback') && dk.require_scopes == false) rescue false
        has_docker_host = tc.public_jwk_url.include?('host.docker.internal') rescue false
        
        if has_target && has_redirects && has_docker_host
          puts '[Rails-LtiVerifier] [$] LTI detectado OK, verificando autosanación de OIDC domain...'
          target_domain = '${canvasDomain}'
          account = Account.default
          current_domain = Setting.get('canvas_domain', 'localhost:8080')
          account_domain = account.settings[:canvas_domain] rescue nil
          
          if current_domain != target_domain || account_domain != target_domain
            puts "[Rails-LtiVerifier] [$] AUTO-CORRECCION: Ajustando dominio OIDC de #{current_domain} a #{target_domain}"
            Setting.set('canvas_domain', target_domain) if Setting.respond_to?(:set)
            if account.respond_to?(:settings)
              account.settings[:canvas_domain] = target_domain
              account.save! rescue nil
            end
          else
             puts "[Rails-LtiVerifier] [$] Dominio OIDC sincronizado (#{target_domain})."
          end
          puts "LTI_OK_ID:#{dk.id}"
          puts "LTI_CLIENT_SECRET:#{dk.api_key}"
        else
          puts "[Rails-LtiVerifier] Faltan campos, o public_jwk_url no usa host.docker.internal."
          puts 'LTI_MISSING'
        end
      else
        puts "[Rails-LtiVerifier] ToolConfiguration NO ENCONTRADO para el DeveloperKey #{dk.id}."
        puts 'LTI_MISSING'
      end
    `;

    try {
      const { success, out, err } = await runCommand('docker', ['compose', 'exec', '-T', '-e', 'DISABLE_SPRING=1', 'web', 'bundle', 'exec', 'rails', 'runner', script], { cwd: CANVAS_DIR });

      if (!success) {
        console.error(`[LtiVerifier] Fallo el script. Stderr:\n${err}`);
        return 'ERROR';
      }

      const okMatchId = out.match(/LTI_OK_ID:(\d+)/);
      const matchSecret = out.match(/LTI_CLIENT_SECRET:([^\r\n]+)/);
      
      if (okMatchId && okMatchId[1]) {
        const clientId = okMatchId[1];
        
        let needsUpdate = false;
        const updates = {};
        
        if (process.env.LTI_CLIENT_ID !== clientId) {
          updates.LTI_CLIENT_ID = clientId;
          process.env.LTI_CLIENT_ID = clientId;
          needsUpdate = true;
        }
        
        if (matchSecret && matchSecret[1] && process.env.LTI_CLIENT_SECRET !== matchSecret[1].trim()) {
          updates.LTI_CLIENT_SECRET = matchSecret[1].trim();
          process.env.LTI_CLIENT_SECRET = updates.LTI_CLIENT_SECRET;
          needsUpdate = true;
        }

        if (needsUpdate) {
          const pluginDir = path.resolve(__dirname, '../../../');
          const { updateEnvVars } = await import('../orchestration/envWriter.js');
          updateEnvVars(pluginDir, updates);
        }
        return 'OK';
      }

      return 'MISSING';
    } catch (e) {
      console.error('[LtiVerifier] Error comprobando estado de Canvas:', e.message);
      return 'ERROR';
    }
  }
}
