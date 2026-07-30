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
    
    // Lockfiles are intentionally kept to maintain idempotence and version stability.
    
    if (!(await this._runLogged(['docker', 'compose', 'exec', '-T', 'web', 'bash', '-c', 'bundle plugin install bundler-multilock && bundle config set --local frozen false && bundle install --jobs=2'], 'Instalando dependencias de Ruby...', 'Error en Ruby.', 'Dependencias de Ruby instaladas', 5))) return false;
    
    if (!(await this._runLogged(['docker', 'compose', 'exec', '-T', 'web', 'yarn', 'install', '--frozen-lockfile', '--network-concurrency', '2', '--child-concurrency', '2'], 'Instalando dependencias Yarn...', 'Error Yarn.', 'Dependencias de Yarn instaladas', 5))) return false;
    
    await this._runLogged(['docker', 'compose', 'exec', '-T', '-e', 'RAILS_ENV=development', 'web', 'bundle', 'exec', 'rake', 'db:create', 'db:migrate'], 'Inicializando base de datos...', 'Warn', 'Base de datos inicializada');
    // Cache is intentionally kept to speed up subsequent executions and avoid OOM errors.
    await this._runLogged(['docker', 'compose', 'exec', '-T', 'web', 'bash', '-c', "find bin script packages -type f -name '*.sh' -o -type f -path '*/scripts/*' | xargs -r sed -i 's/\\r$//' 2>/dev/null; find bin script -type f | xargs -r sed -i 's/\\r$//' 2>/dev/null; true"], 'Normalizando CRLF...', 'Warn', 'CRLF normalizado');
    
    // Parchear archivo .i18nrc localmente (sin bash para evitar problemas con CRLF)
    const i18nrcPath = path.join(this.canvasDir, '.i18nrc');
    if (fs.existsSync(i18nrcPath)) {
      // Usar escritura directa del JSON correcto para evitar SyntaxErrors por comas residuales de regex
      fs.writeFileSync(i18nrcPath, JSON.stringify({ plugins: ["@instructure/i18nliner-canvas"] }, null, 2));
    }

    // Ya no parcheamos ConfigureModal.tsx porque @instructure/platform-alerts es la ruta correcta en esta versión de Canvas.
    if (!(await this._runLogged(['docker', 'compose', 'exec', '-T', 'web', 'bundle', 'exec', 'rake', 'i18n:generate_js'], 'Generando traducciones...', 'Fallo en i18n:generate_js.', 'Traducciones generadas', 5))) return false;
    
    if (!(await this._runLogged(['docker', 'compose', 'exec', '-T', 'web', 'yarn', 'run', 'build:packages'], 'Construyendo paquetes internos...', 'Fallo en build:packages.', 'Paquetes construidos', 5))) return false;
    
    if (!(await this._runLogged(['docker', 'compose', 'exec', '-T', '-e', 'CANVAS_BUILD_CONCURRENCY=1', '-e', 'PARALLEL_PROCESSORS=1', '-e', 'DISABLE_HAPPYPACK=1', '-e', 'NODE_OPTIONS=--max-old-space-size=2048', '-e', 'COMPILE_ASSETS_API_DOCS=0', '-e', 'COMPILE_ASSETS_BRAND_CONFIGS=0', 'web', 'bundle', 'exec', 'rake', 'canvas:compile_assets'], 'Compilando assets...', 'Falló la compilación de assets.', 'Assets compilados exitosamente', 10))) return false;
    
    await this._runLogged(['docker', 'compose', 'exec', '-T', 'web', 'bundle', 'exec', 'rake', 'brand_configs:write'], 'Generando brand configs...', 'Warn', 'Brand configs generados');

    // Add success marker to signify complete and non-corrupted setup
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.writeFileSync(path.join(this.canvasDir, '.assets_built'), 'true');

    return true;
  }

  _configureEssentialFiles() {
    const configDir = path.join(this.canvasDir, 'config');
    const essentialFiles = [
      "database.yml", "domain.yml", "security.yml",
      "dynamic_settings.yml", "cache_store.yml", "redis.yml",
      "outgoing_mail.yml", "delayed_jobs.yml"
    ];

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!fs.existsSync(configDir)) return;

    for (const name of essentialFiles) {
      const target = path.join(configDir, name);
      const example = path.join(configDir, `${name}.example`);
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      if (fs.existsSync(example) && !fs.existsSync(target)) {
        fs.copyFileSync(example, target);
      }
    }

    for (const name of ["consul.yml", "vault.yml", "dynamodb.yml"]) {
      const bad = path.join(configDir, name);
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      if (fs.existsSync(bad)) fs.unlinkSync(bad);
    }

    // Force exact docker settings without destroying other environments
    const dbYmlPath = path.join(configDir, 'database.yml');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (fs.existsSync(dbYmlPath)) {
      try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
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
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        fs.writeFileSync(dbYmlPath, yaml.dump(dbConfig));
      } catch (e) {
        this.boot.warn(`Error al modificar database.yml: ${e}`);
      }
    }
    const domainYmlPath = path.join(configDir, 'domain.yml');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (fs.existsSync(domainYmlPath)) {
      try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const domainConfig = yaml.load(fs.readFileSync(domainYmlPath, 'utf8')) || {};
        domainConfig.development = { domain: "localhost:8080" };
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        fs.writeFileSync(domainYmlPath, yaml.dump(domainConfig));
      } catch (e) {
        this.boot.warn(`Error al modificar domain.yml: ${e}`);
      }
    }

    const overrideFile = path.join(this.canvasDir, 'docker-compose.override.yml');
    let overrideConfig = { services: {}, volumes: {} };
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (fs.existsSync(overrideFile)) {
      try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const content = fs.readFileSync(overrideFile, 'utf8');
        overrideConfig = yaml.load(content) || overrideConfig;
      } catch (e) {
        this.boot.warn(`Error leyendo docker-compose.override.yml: ${e}`);
      }
    }

    if (!overrideConfig.services) overrideConfig.services = {};
    if (!overrideConfig.volumes) overrideConfig.volumes = {};

    // Jobs service
    if (!overrideConfig.services.jobs) overrideConfig.services.jobs = {};
    delete overrideConfig.services.jobs.mem_limit;
    delete overrideConfig.services.jobs.cpus;
    overrideConfig.services.jobs.deploy = {
      resources: { limits: { memory: '2G', cpus: '1' } }
    };
    if (!overrideConfig.services.jobs.volumes) {
      overrideConfig.services.jobs.volumes = [
        ".:/usr/src/app",
        "canvas-bundle-gems:/home/docker/.gem",
        "canvas-bundle-plugin:/home/docker/.bundle"
      ];
    }

    // Web service
    if (!overrideConfig.services.web) overrideConfig.services.web = {};
    delete overrideConfig.services.web.mem_limit;
    delete overrideConfig.services.web.cpus;
    overrideConfig.services.web.deploy = {
      resources: { limits: { memory: '8G', cpus: '2' } }
    };
    overrideConfig.services.web.ports = overrideConfig.services.web.ports || ["8080:80"];
    overrideConfig.services.web.environment = overrideConfig.services.web.environment || {};
    overrideConfig.services.web.environment.RSPACK = 'true';
    overrideConfig.services.web.environment.CANVAS_LTI_COURSE_NAVIGATION = 'true';
    if (!overrideConfig.services.web.volumes) {
      overrideConfig.services.web.volumes = [
        ".:/usr/src/app",
        "canvas-bundle-gems:/home/docker/.gem",
        "canvas-bundle-plugin:/home/docker/.bundle"
      ];
    }

    // Volumes
    overrideConfig.volumes['canvas-bundle-gems'] = overrideConfig.volumes['canvas-bundle-gems'] || null;
    overrideConfig.volumes['canvas-bundle-plugin'] = overrideConfig.volumes['canvas-bundle-plugin'] || null;

    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.writeFileSync(overrideFile, yaml.dump(overrideConfig));
    } catch (e) {
      this.boot.warn(`Error escribiendo docker-compose.override.yml: ${e}`);
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
        spinner.success({ text: successMsg, mark: '  √' });
        return true;
      }
      
      spinner.error({ text: `${failMsg} Código ${code}`, mark: '  ×' });
      if (attempt < maxRetries) {
        attempt++;
        const backoff = Math.min(Math.pow(2, attempt) * 1000, 15000);
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
