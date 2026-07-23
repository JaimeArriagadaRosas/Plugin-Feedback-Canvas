import fs from 'node:fs';
import path from 'node:path';
import { runCommand } from '../utils/Runner.js';
import { analyzeLogAndDiagnose, printDiagnosisBox } from '../utils/Diagnostics.js';
import { createSpinner } from 'nanospinner';
import * as yaml from 'js-yaml';

export class AssetBuilder {
  constructor(boot, logFile, canvasDir) {
    this.boot = boot;
    this.logFile = logFile;
    this.canvasDir = canvasDir;
  }

  async setupAssets() {
    this.boot.plain('');
    this.boot.plain('=========================================================');
    this.boot.plain('   CONFIGURANDO DEPENDENCIAS Y ASSETS DE CANVAS LMS');
    this.boot.plain('=========================================================');

    this._configureEssentialFiles();

    // Ensure Redis is up and recreate web to apply domain.yml and Redis config
    await runCommand('docker', ['compose', 'up', '-d', 'redis'], { cwd: this.canvasDir });
    await runCommand('docker', ['compose', 'up', '-d', '--force-recreate', 'web'], { cwd: this.canvasDir });

    if (!(await this._runLogged(['docker', 'info'], 'Verificando daemon Docker...', 'Docker no responde.', 'Docker en ejecución'))) return false;
    if (!(await this._runLogged(['docker', 'compose', 'up', '-d'], 'Iniciando contenedores...', 'Falló el inicio.', 'Contenedores iniciados'))) return false;
    
    await this._runLogged(['docker', 'compose', 'exec', '-T', 'web', 'bash', '-c', 'find gems -maxdepth 2 -name Gemfile.lock -delete 2>/dev/null; true'], 'Limpiando lockfiles...', 'Warn', 'Lockfiles limpiados');
    
    if (!(await this._runLogged(['docker', 'compose', 'exec', '-T', 'web', 'bash', '-c', 'bundle config set --local frozen false && bundle install --jobs=2'], 'Instalando dependencias de Ruby...', 'Error en Ruby.', 'Dependencias de Ruby instaladas', 5))) return false;
    
    if (!(await this._runLogged(['docker', 'compose', 'exec', '-T', 'web', 'yarn', 'install', '--network-concurrency', '2', '--child-concurrency', '2'], 'Instalando dependencias Yarn...', 'Error Yarn.', 'Dependencias de Yarn instaladas', 5))) return false;
    
    await this._runLogged(['docker', 'compose', 'exec', '-T', '-e', 'RAILS_ENV=development', 'web', 'bundle', 'exec', 'rake', 'db:create', 'db:migrate'], 'Inicializando base de datos...', 'Warn', 'Base de datos inicializada');
    await this._runLogged(['docker', 'compose', 'exec', '-T', 'web', 'bash', '-c', 'rm -rf public/dist/* node_modules/.cache'], 'Limpiando caché...', 'Warn', 'Caché limpio');
    await this._runLogged(['docker', 'compose', 'exec', '-T', 'web', 'bash', '-c', "find bin script packages -type f -name '*.sh' -o -type f -path '*/scripts/*' | xargs -r sed -i 's/\\r$//' 2>/dev/null; find bin script -type f | xargs -r sed -i 's/\\r$//' 2>/dev/null; true"], 'Normalizando CRLF...', 'Warn', 'CRLF normalizado');
    await this._runLogged(['docker', 'compose', 'exec', '-T', 'web', 'bash', '-c', "sed -i \"s|from '@instructure/platform-alerts'|from '@canvas/alerts/react/FlashAlert'|g\" ui/features/discovery_page/react/components/ConfigureModal.tsx 2>/dev/null; true"], 'Aplicando parches...', 'Warn', 'Parches aplicados');
    await this._runLogged(['docker', 'compose', 'exec', '-T', 'web', 'bundle', 'exec', 'rake', 'i18n:generate_js'], 'Generando traducciones...', 'Warn', 'Traducciones generadas');
    
    if (!(await this._runLogged(['docker', 'compose', 'exec', '-T', 'web', 'yarn', 'run', 'build:packages'], 'Construyendo paquetes internos...', 'Fallo en build:packages.', 'Paquetes construidos'))) return false;
    
    if (!(await this._runLogged(['docker', 'compose', 'exec', '-T', '-e', 'CANVAS_BUILD_CONCURRENCY=2', '-e', 'NODE_OPTIONS=--max-old-space-size=8192', '-e', 'COMPILE_ASSETS_API_DOCS=0', '-e', 'COMPILE_ASSETS_BRAND_CONFIGS=0', 'web', 'bundle', 'exec', 'rake', 'canvas:compile_assets'], 'Compilando assets (10-15 mins)...', 'Falló la compilación de assets.', 'Assets compilados exitosamente'))) return false;
    
    await this._runLogged(['docker', 'compose', 'exec', '-T', 'web', 'bundle', 'exec', 'rake', 'brand_configs:write'], 'Generando brand configs...', 'Warn', 'Brand configs generados');

    return true;
  }

  _configureEssentialFiles() {
    const configDir = path.join(this.canvasDir, 'config');
    const essentialFiles = [
      "database.yml", "domain.yml", "security.yml",
      "dynamic_settings.yml", "cache_store.yml", "redis.yml",
      "outgoing_mail.yml", "delayed_jobs.yml"
    ];

    if (!fs.existsSync(configDir)) return;

    for (const name of essentialFiles) {
      const target = path.join(configDir, name);
      const example = path.join(configDir, `${name}.example`);
      if (fs.existsSync(example) && !fs.existsSync(target)) {
        fs.copyFileSync(example, target);
      }
    }

    for (const name of ["consul.yml", "vault.yml", "dynamodb.yml"]) {
      const bad = path.join(configDir, name);
      if (fs.existsSync(bad)) fs.unlinkSync(bad);
    }

    // Force exact docker settings without destroying other environments
    const dbYmlPath = path.join(configDir, 'database.yml');
    if (fs.existsSync(dbYmlPath)) {
      try {
        const dbConfig = yaml.load(fs.readFileSync(dbYmlPath, 'utf8')) || {};
        dbConfig.development = {
          adapter: 'postgresql',
          encoding: 'utf8',
          database: 'canvas_development',
          host: 'postgres',
          username: 'postgres',
          password: 'sekret',
          timeout: 5000
        };
        dbConfig.test = {
          adapter: 'postgresql',
          encoding: 'utf8',
          database: 'canvas_test',
          host: 'postgres',
          username: 'postgres',
          password: 'sekret',
          timeout: 5000
        };
        fs.writeFileSync(dbYmlPath, yaml.dump(dbConfig));
      } catch (e) {
        this.boot.warn(`Error al modificar database.yml: ${e}`);
      }
    }
    const domainYmlPath = path.join(configDir, 'domain.yml');
    if (fs.existsSync(domainYmlPath)) {
      try {
        const domainConfig = yaml.load(fs.readFileSync(domainYmlPath, 'utf8')) || {};
        domainConfig.development = { domain: "localhost:8080" };
        fs.writeFileSync(domainYmlPath, yaml.dump(domainConfig));
      } catch (e) {
        this.boot.warn(`Error al modificar domain.yml: ${e}`);
      }
    }

    const overrideFile = path.join(this.canvasDir, 'docker-compose.override.yml');
    if (!fs.existsSync(overrideFile)) {
      fs.writeFileSync(overrideFile, `services:
  jobs:
    mem_limit: 2g
    cpus: '1'
    volumes:
      - .:/usr/src/app
      - canvas-bundle-gems:/home/docker/.gem
  web:
    mem_limit: 4g
    cpus: '2'
    ports:
      - "8080:80"
    environment:
      RSPACK: 'true'
      CANVAS_LTI_COURSE_NAVIGATION: 'true'
    volumes:
      - .:/usr/src/app
      - canvas-bundle-gems:/home/docker/.gem

volumes:
  canvas-bundle-gems:
`);
    }
  }

  async _runLogged(cmdArgs, startMsg, failMsg, successMsg, maxRetries = 0) {
    let attempt = 0;
    while (attempt <= maxRetries) {
      const msg = attempt === 0 ? startMsg : `${startMsg} (Reintento ${attempt}/${maxRetries})`;
      const spinner = createSpinner(msg).start();
      const command = cmdArgs[0];
      const args = cmdArgs.slice(1);
      
      let lastLine = '';
      const { success, code } = await runCommand(command, args, {
        cwd: this.canvasDir,
        logFile: this.logFile,
        onData: (str) => {
          const lines = str.trim().split('\n');
          if (lines.length && lines[lines.length - 1].trim()) {
            lastLine = lines[lines.length - 1].trim();
            const trunc = lastLine.length < 60 ? lastLine : lastLine.substring(0, 57) + '...';
            spinner.update({ text: `${startMsg} > ${trunc}` });
          }
        }
      });

      if (success) {
        spinner.success({ text: successMsg });
        return true;
      }
      
      spinner.error({ text: `${failMsg} Código ${code}` });
      if (attempt < maxRetries) {
        attempt++;
        const backoff = Math.pow(2, attempt) * 1000;
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }
      
      const diagnosis = analyzeLogAndDiagnose(this.logFile);
      if (diagnosis) {
        printDiagnosisBox(this.boot, diagnosis);
      } else {
        this.boot.error(`Falló sin diagnóstico. Revisar log: ${this.logFile}`);
      }
      return false;
    }
  }
}
