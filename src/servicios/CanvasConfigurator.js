import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, execSync } from 'child_process';
import DockerRunner, { CANVAS_PATH, writeDockerLog, startSpinner } from './DockerRunner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class CanvasConfigurator {
  static copyDefaultConfigs() {
    console.log('[CanvasConfigurator] Copiando archivos de configuración por defecto...');
    try {
      const composeConfigDir = path.join(CANVAS_PATH, 'docker-compose/config');
      const configDir = path.join(CANVAS_PATH, 'config');
      
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      if (fs.existsSync(composeConfigDir)) {
        const files = fs.readdirSync(composeConfigDir);
        files.forEach((file) => {
          if (file.endsWith('.yml')) {
            const srcPath = path.join(composeConfigDir, file);
            const destPath = path.join(configDir, file);
            if (!fs.existsSync(destPath)) {
              fs.copyFileSync(srcPath, destPath);
              console.log(`[CanvasConfigurator] Copiado: config/${file}`);
            }
          }
        });
      }

      const overridePath = path.join(CANVAS_PATH, 'docker-compose.override.yml');
      const overrideExamplePath = path.join(configDir, 'docker-compose.override.yml.example');
      if (!fs.existsSync(overridePath)) {
        if (fs.existsSync(overrideExamplePath)) {
          fs.copyFileSync(overrideExamplePath, overridePath);
          console.log('[CanvasConfigurator] Copiado docker-compose.override.yml a partir del .example');
        } else {
          console.warn('[CanvasConfigurator] Advertencia: No se encontró docker-compose.override.yml.example');
        }
      }

      // Asegurar que el puerto 8080:80 esté mapeado en el servicio web
      if (fs.existsSync(overridePath)) {
        let overrideContent = fs.readFileSync(overridePath, 'utf8');
        if (!overrideContent.includes('8080:80') && !overrideContent.includes('"8080:80"')) {
          // Reemplazar usando una función para mayor seguridad con saltos de línea
          if (overrideContent.includes('  web:')) {
            const parts = overrideContent.split('  web:');
            if (parts.length > 1) {
              parts[1] = parts[1].replace(/environment:/, 'ports:\n      - "8080:80"\n    environment:');
              overrideContent = parts.join('  web:');
            }
          }
          fs.writeFileSync(overridePath, overrideContent);
          console.log('[CanvasConfigurator] Parcheado docker-compose.override.yml con puerto 8080:80');
        }
      }

      const envPath = path.join(CANVAS_PATH, '.env');
      const separator = process.platform === 'win32' ? ';' : ':';
      const expectedContent = `COMPOSE_FILE=docker-compose.yml${separator}docker-compose.override.yml`;
      
      let needsWrite = false;
      if (!fs.existsSync(envPath)) {
        needsWrite = true;
      } else {
        const currentContent = fs.readFileSync(envPath, 'utf8').trim();
        if (process.platform === 'win32' && currentContent.includes('docker-compose.yml:')) {
          needsWrite = true;
        }
      }

      if (needsWrite) {
        fs.writeFileSync(envPath, expectedContent);
        console.log('[CanvasConfigurator] Creado/Actualizado archivo .env con COMPOSE_FILE configurado');
      }

      const dbDir = path.join(CANVAS_PATH, 'db');
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      const structPath = path.join(dbDir, 'structure.sql');
      if (!fs.existsSync(structPath)) {
        fs.writeFileSync(structPath, '');
        console.log('[CanvasConfigurator] Creado db/structure.sql vacío para asegurar permisos de escritura');
      }

      return true;
    } catch (error) {
      console.error('[CanvasConfigurator] Error copiando configuraciones por defecto:', error.message);
      return false;
    }
  }

  static updatePluginEnv(clientId, apiToken = null, courseId = null) {
    const pluginEnvPath = path.resolve(__dirname, '../../.env');
    console.log(`[CanvasConfigurator] Actualizando .env del Plugin en: ${pluginEnvPath}`);
    try {
      if (!fs.existsSync(pluginEnvPath)) {
        console.error(`[CanvasConfigurator] ERROR: No se encontró el archivo .env del plugin en ${pluginEnvPath}`);
        return false;
      }
      
      let envContent = fs.readFileSync(pluginEnvPath, 'utf8');
      
      if (envContent.includes('LTI_CLIENT_ID=')) {
        envContent = envContent.replace(/LTI_CLIENT_ID=.*/g, `LTI_CLIENT_ID=${clientId}`);
      } else {
        envContent += `\nLTI_CLIENT_ID=${clientId}`;
      }

      if (envContent.includes('VITE_CANVAS_BASE_URL=')) {
        envContent = envContent.replace(/VITE_CANVAS_BASE_URL=.*/g, `VITE_CANVAS_BASE_URL=http://localhost:8080`);
      } else {
        envContent += `\nVITE_CANVAS_BASE_URL=http://localhost:8080`;
      }

      if (envContent.includes('CANVAS_OIDC_URL=')) {
        envContent = envContent.replace(/CANVAS_OIDC_URL=.*/g, `CANVAS_OIDC_URL=http://localhost:8080/api/lti/authorize_redirect`);
      } else {
        envContent += `\nCANVAS_OIDC_URL=http://localhost:8080/api/lti/authorize_redirect`;
      }
      
      if (apiToken) {
        if (envContent.includes('VITE_CANVAS_ACCESS_TOKEN=')) {
          envContent = envContent.replace(/VITE_CANVAS_ACCESS_TOKEN=.*/g, `VITE_CANVAS_ACCESS_TOKEN=${apiToken}`);
        } else {
          envContent += `\nVITE_CANVAS_ACCESS_TOKEN=${apiToken}`;
        }
        process.env.VITE_CANVAS_ACCESS_TOKEN = apiToken;
      }

      if (courseId) {
        if (envContent.includes('VITE_CANVAS_COURSE_ID=')) {
          envContent = envContent.replace(/VITE_CANVAS_COURSE_ID=.*/g, `VITE_CANVAS_COURSE_ID=${courseId}`);
        } else {
          envContent += `\nVITE_CANVAS_COURSE_ID=${courseId}`;
        }
        process.env.VITE_CANVAS_COURSE_ID = courseId;
      }

      fs.writeFileSync(pluginEnvPath, envContent);
      console.log(`[CanvasConfigurator] Archivo .env actualizado con LTI_CLIENT_ID=${clientId}${courseId ? ` y VITE_CANVAS_COURSE_ID=${courseId}` : ''}`);
      return true;
    } catch (error) {
      console.error('[CanvasConfigurator] Error actualizando el .env del plugin:', error.message);
      return false;
    }
  }

  static setupLtiAndMockData() {
    return new Promise((resolve, reject) => {
      console.log('[CanvasConfigurator] Iniciando configuración de LTI y datos dummy...');
      
      let rubyScript;
      try {
        const seedsPath = path.resolve(__dirname, '../../db/seeds/canvas_seeds.rb');
        rubyScript = fs.readFileSync(seedsPath, 'utf8');
      } catch (err) {
        console.error('[CanvasConfigurator] Error leyendo db/seeds/canvas_seeds.rb:', err.message);
        return reject(err);
      }

      try {
        const tmpDir = path.join(CANVAS_PATH, 'tmp');
        if (!fs.existsSync(tmpDir)) {
          fs.mkdirSync(tmpDir, { recursive: true });
        }
        const scriptPath = path.join(tmpDir, 'setup_lti_and_data.rb');
        fs.writeFileSync(scriptPath, rubyScript);
        console.log('[CanvasConfigurator] Script Ruby escrito en: tmp/setup_lti_and_data.rb');

        console.log('[CanvasConfigurator] Copiando script al contenedor Docker...');
        try {
          execSync('docker compose cp tmp/setup_lti_and_data.rb web:/usr/src/app/tmp/setup_lti_and_data.rb', { cwd: CANVAS_PATH, stdio: 'ignore' });
        } catch (cpErr) {
          console.error('[CanvasConfigurator] Error copiando script al contenedor:', cpErr.message);
          return reject(cpErr);
        }

        console.log('[CanvasConfigurator] Ejecutando script de Ruby en Canvas... (Ver logs/docker_canvas.log)');

        const dockerProcess = spawn('docker', ['compose', 'exec', '-T', 'web', 'bundle', 'exec', 'rails', 'runner', 'tmp/setup_lti_and_data.rb'], {
          cwd: CANVAS_PATH
        });

        const spinner = startSpinner('Inyectando Datos de Prueba y LTI...');

        let stdoutBuffer = '';

        dockerProcess.stdout.on('data', (data) => {
          const text = data.toString();
          stdoutBuffer += text;
          writeDockerLog('[LTI-Setup-Stdout]', data);
        });

        dockerProcess.stderr.on('data', (data) => {
          writeDockerLog('[LTI-Setup-Stderr]', data);
        });

        dockerProcess.on('close', async (code) => {
          spinner.stop();
          if (code === 0) {
            console.log('[CanvasConfigurator] Script Ruby ejecutado con exito.');
            
            let clientId = null;
            let courseId = null;
            const matchLTI = stdoutBuffer.match(/LTI_CLIENT_ID:(\d+)/);
            const matchToken = stdoutBuffer.match(/CANVAS_API_TOKEN:([a-zA-Z0-9~_-]+)/);
            const matchCourse = stdoutBuffer.match(/COURSE_ID:(\d+)/);
            
            if (matchLTI && matchLTI[1]) {
              clientId = matchLTI[1];
              const apiToken = matchToken && matchToken[1] ? matchToken[1] : null;
              courseId = matchCourse && matchCourse[1] ? matchCourse[1] : null;
              
              console.log(`[CanvasConfigurator] ID de Cliente LTI encontrado: ${clientId}`);
              if (apiToken) console.log(`[CanvasConfigurator] Token API encontrado: ${apiToken}`);
              if (courseId) console.log(`[CanvasConfigurator] Course ID encontrado: ${courseId}`);
              
              this.updatePluginEnv(clientId, apiToken, courseId);
            }
            try {
              const hostTmpDir = path.join(CANVAS_PATH, 'tmp');
              if (!fs.existsSync(hostTmpDir)) fs.mkdirSync(hostTmpDir, { recursive: true });
              execSync('docker compose cp web:/usr/src/app/tmp/perfiles_data.json tmp/perfiles_data.json', { cwd: CANVAS_PATH, stdio: 'ignore' });
              console.log('[CanvasConfigurator] tmp/perfiles_data.json copiados al host.');
            } catch (cpErr) {
              console.error('[CanvasConfigurator] Error copiando tmp/perfiles_data.json del contenedor:', cpErr.message);
            }

            resolve(clientId);
          } else {
            console.error(`[CanvasConfigurator] El script de LTI termino con codigo de error ${code}.`);
            reject(new Error(`El script de LTI fallo con codigo ${code}`));
          }
        });

        dockerProcess.on('error', (err) => {
          spinner.stop();
          console.error('[CanvasConfigurator] ❌ Error ejecutando rails runner:', err.message);
          reject(err);
        });

      } catch (error) {
        console.error('[CanvasConfigurator] Error configurando script Ruby:', error.message);
        reject(error);
      }
    });
  }

  static async runPluginMigrations() {
    console.log('[CanvasConfigurator] Sincronizando y ejecutando migraciones del plugin en Canvas...');
    try {
      const hostMigrateDir = path.resolve(__dirname, '../../db/migrate');
      const canvasMigrateDir = path.join(CANVAS_PATH, 'db/migrate');

      if (!fs.existsSync(hostMigrateDir)) {
        console.log('[CanvasConfigurator] No se encontraron migraciones en db/migrate.');
        return;
      }

      if (!fs.existsSync(canvasMigrateDir)) {
        fs.mkdirSync(canvasMigrateDir, { recursive: true });
      }

      const files = fs.readdirSync(hostMigrateDir);
      for (const file of files) {
        if (file.endsWith('.rb')) {
          const srcPath = path.join(hostMigrateDir, file);
          const destPath = path.join(canvasMigrateDir, file);
          
          fs.copyFileSync(srcPath, destPath);
          console.log(`[CanvasConfigurator] Migración copiada al host: db/migrate/${file}`);

          try {
            execSync(`docker compose cp db/migrate/${file} web:/usr/src/app/db/migrate/${file}`, {
              cwd: CANVAS_PATH,
              stdio: 'ignore'
            });
            console.log(`[CanvasConfigurator] Migración copiada al contenedor: web:/usr/src/app/db/migrate/${file}`);
          } catch (err) {
            console.error(`[CanvasConfigurator] Error al copiar migración al contenedor: ${err.message}`);
          }
        }
      }

      await DockerRunner.runDockerCommand(['compose', 'exec', '-T', 'web', 'bundle', 'exec', 'rails', 'db:migrate'], 'Rails-Db-Migrate');
    } catch (error) {
      console.error('[CanvasConfigurator] Error al ejecutar migraciones del plugin:', error.message);
      throw error;
    }
  }
}

export default CanvasConfigurator;
