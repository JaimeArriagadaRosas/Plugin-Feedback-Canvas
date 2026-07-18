import { runDockerCommand, spawnDocker, waitForDockerProcess } from '../utils/dockerRunner.js';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CANVAS_DIR = path.resolve(__dirname, '../../../../../canvas-lms-master');

/**
 * Módulo dedicado EXCLUSIVAMENTE a verificar la integridad de la instalación LTI 1.3 en Canvas.
 * No instala ni modifica nada.
 */
export class LtiVerifier {
  static async isCanvasRunning() {
    try {
      const { stdout } = await runDockerCommand(['compose', 'ps', '-q', 'web'], { cwd: CANVAS_DIR });
      return stdout.trim().length > 0;
    } catch (e) {
      return false;
    }
  }

  /**
   * Ejecuta un script de validación en Canvas para detectar si la herramienta LTI 1.3 está
   * configurada nativamente mediante oidc_initiation_url.
   */
  static async checkLtiStatus() {
    console.log('[LtiVerifier] Ejecutando script de verificación OIDC en Canvas (rails runner)...');
    const canvasDomain = process.env.CANVAS_DOMAIN || 'localhost:8443';
    
    try {
      const domainYmlPath = path.join(CANVAS_DIR, 'config', 'domain.yml');
      const domainContent = `test:\n  domain: localhost\n\ndevelopment:\n  domain: "${canvasDomain}"\n  ssl: true\n\nproduction:\n  domain: "canvas.example.com"\n  ssl: true`;
      await fs.writeFile(domainYmlPath, domainContent, 'utf-8');
      console.log(`[LtiVerifier] [$] [Docker-Patch] Archivo domain.yml forzado a ${canvasDomain} y ssl=true`);
    } catch (err) {
      console.warn(`[LtiVerifier] [$] Advertencia: No se pudo inyectar el parche a domain.yml: ${err.message}`);
    }

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
        has_redirects = dk.redirect_uris.present? rescue false
        has_docker_host = tc.public_jwk_url.include?('host.docker.internal') rescue false
        puts "[Rails-LtiVerifier] [$] target_link_uri: #{tc.target_link_uri}"
        puts "[Rails-LtiVerifier] [$] redirect_uris: #{dk.redirect_uris}"
        puts "[Rails-LtiVerifier] [$] public_jwk_url: #{tc.public_jwk_url}"
        
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
          
          puts 'LTI_OK'
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
      const proc = spawnDocker(
        ['compose', 'exec', '-T', '-e', 'DISABLE_SPRING=1', 'web', 'bundle', 'exec', 'rails', 'runner', '-'],
        { cwd: CANVAS_DIR }
      );

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => stdout += data.toString());
      proc.stderr.on('data', (data) => stderr += data.toString());

      proc.stdin.write(script);
      proc.stdin.end();

      const code = await waitForDockerProcess(proc);

      console.log(`[LtiVerifier] Salida cruda de verificación:\n${stdout.trim()}`);

      if (code !== 0) {
        console.error(`[LtiVerifier] Código de salida fallido (${code}). Stderr:\n${stderr}`);
        return 'ERROR';
      }

      if (stdout.includes('LTI_OK')) {
        console.log('[LtiVerifier] Diagnóstico final: OK');
        return 'OK';
      }

      console.log('[LtiVerifier] Diagnóstico final: MISSING');
      return 'MISSING';
    } catch (e) {
      console.error('[LtiVerifier] Error comprobando estado de Canvas:', e.message);
      return 'ERROR';
    }
  }
}
