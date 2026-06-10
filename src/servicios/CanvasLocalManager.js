import { spawn, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolver la ruta de la carpeta canvas-lms-master (3 niveles arriba desde src/servicios)
const CANVAS_PATH = path.resolve(__dirname, '../../../canvas-lms-master');

// Configurar directorio de logs
const LOGS_DIR = path.resolve(__dirname, '../../logs');
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}
const DOCKER_LOG_FILE = path.join(LOGS_DIR, 'docker_canvas.log');

function writeDockerLog(prefix, data) {
  const text = data.toString();
  const timestamp = new Date().toISOString();
  fs.appendFileSync(DOCKER_LOG_FILE, `[${timestamp}] ${prefix}: ${text}`);
}

class CanvasLocalManager {
  /**
   * Verifica si Docker está activo en el sistema.
   * @returns {boolean}
   */
  static checkDocker() {
    try {
      execSync('docker info', { stdio: 'ignore' });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Copia los archivos de configuración de base de datos y entorno por defecto de Canvas
   * si aún no existen.
   */
  static copyDefaultConfigs() {
    console.log('[CanvasLocalManager] Copiando archivos de configuración por defecto...');
    try {
      const composeConfigDir = path.join(CANVAS_PATH, 'docker-compose/config');
      const configDir = path.join(CANVAS_PATH, 'config');
      
      // Asegurarse de que el directorio config existe
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      // Copiar todos los archivos .yml de docker-compose/config a config/
      if (fs.existsSync(composeConfigDir)) {
        const files = fs.readdirSync(composeConfigDir);
        files.forEach((file) => {
          if (file.endsWith('.yml')) {
            const srcPath = path.join(composeConfigDir, file);
            const destPath = path.join(configDir, file);
            if (!fs.existsSync(destPath)) {
              fs.copyFileSync(srcPath, destPath);
              console.log(`[CanvasLocalManager] Copiado: config/${file}`);
            }
          }
        });
      }

      // Configurar docker-compose.override.yml
      const overridePath = path.join(CANVAS_PATH, 'docker-compose.override.yml');
      const overrideExamplePath = path.join(configDir, 'docker-compose.override.yml.example');
      if (!fs.existsSync(overridePath)) {
        if (fs.existsSync(overrideExamplePath)) {
          fs.copyFileSync(overrideExamplePath, overridePath);
          console.log('[CanvasLocalManager] Copiado docker-compose.override.yml a partir del .example');
        } else {
          console.warn('[CanvasLocalManager] Advertencia: No se encontró docker-compose.override.yml.example');
        }
      }

      // Configurar .env de Canvas
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
        console.log('[CanvasLocalManager] Creado/Actualizado archivo .env con COMPOSE_FILE configurado');
      }

      // Tocar el archivo db/structure.sql para evitar problemas de permisos
      const dbDir = path.join(CANVAS_PATH, 'db');
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      const structPath = path.join(dbDir, 'structure.sql');
      if (!fs.existsSync(structPath)) {
        fs.writeFileSync(structPath, '');
        console.log('[CanvasLocalManager] Creado db/structure.sql vacío para asegurar permisos de escritura');
      }

      return true;
    } catch (error) {
      console.error('[CanvasLocalManager] Error copiando configuraciones por defecto:', error.message);
      return false;
    }
  }

  /**
   * Inicia localmente Canvas LMS en segundo plano.
   * @returns {Promise<boolean>}
   */
  static startCanvas() {
    return new Promise((resolve, reject) => {
      console.log('[CanvasLocalManager] Verificando Docker Desktop...');
      if (!this.checkDocker()) {
        console.error('[CanvasLocalManager] ERROR: Docker no está en ejecución.');
        console.error('Por favor, asegúrate de iniciar "Docker Desktop" y de que WSL2 esté activo antes de continuar.');
        return reject(new Error('Docker no está en ejecución.'));
      }

      console.log(`[CanvasLocalManager] Levantando contenedores Canvas en segundo plano. Los detalles se guardan en logs/docker_canvas.log...`);
      
      // Lanzar docker compose up -d de forma asíncrona
      const dockerProcess = spawn('docker', ['compose', 'up', '-d'], {
        cwd: CANVAS_PATH
      });

      dockerProcess.stdout.on('data', (data) => {
        writeDockerLog('[Docker-Stdout]', data);
      });

      dockerProcess.stderr.on('data', (data) => {
        writeDockerLog('[Docker-Stderr]', data);
      });

      dockerProcess.on('close', (code) => {
        if (code === 0) {
          console.log('[CanvasLocalManager] Comando docker compose up -d ejecutado con éxito.');
          resolve(true);
        } else {
          console.error(`[CanvasLocalManager] El proceso de Docker terminó con código de error ${code}.`);
          reject(new Error(`docker compose falló con código ${code}`));
        }
      });

      dockerProcess.on('error', (err) => {
        console.error('[CanvasLocalManager] Error al intentar iniciar docker compose:', err.message);
        reject(err);
      });
    });
  }

  /**
   * Helper genérico para ejecutar comandos dentro de los contenedores Docker en ejecución.
   * @param {Array<string>} args Argumentos del comando docker.
   * @param {string} label Etiqueta para diferenciar los logs.
   */
  static runDockerCommand(args, label) {
    return new Promise((resolve, reject) => {
      console.log(`[CanvasLocalManager] Ejecutando: ${label}... (Ver logs/docker_canvas.log)`);
      
      const dockerProcess = spawn('docker', args, {
        cwd: CANVAS_PATH
      });

      dockerProcess.stdout.on('data', (data) => {
        writeDockerLog(`[${label}-Stdout]`, data);
      });

      dockerProcess.stderr.on('data', (data) => {
        writeDockerLog(`[${label}-Stderr]`, data);
      });

      dockerProcess.on('close', (code) => {
        if (code === 0) {
          console.log(`[CanvasLocalManager] Éxito: ${label} completado.`);
          resolve(true);
        } else {
          console.error(`[CanvasLocalManager] Error: ${label} falló con código ${code}.`);
          reject(new Error(`${label} falló`));
        }
      });

      dockerProcess.on('error', (err) => {
        console.error(`[CanvasLocalManager] Error ejecutando ${label}:`, err.message);
        reject(err);
      });
    });
  }

  /**
   * Ejecuta el pipeline completo de inicialización para Canvas.
   */
  static async initializeCanvas() {
    console.log('[CanvasLocalManager] Iniciando inicialización completa de Canvas LMS...');
    try {
      // 0. Instalar plugin de bundler para evitar caídas en parsing de Gemfile
      try {
        await this.runDockerCommand(['compose', 'exec', '-T', 'web', 'bundle', 'plugin', 'install', 'bundler-multilock'], 'Ruby-Bundler-Plugin-Install');
      } catch (err) {
        console.warn('[CanvasLocalManager] Omitiendo o falló instalación de plugin bundler:', err.message);
      }

      // 1. Instalar gemas Ruby
      await this.runDockerCommand(['compose', 'exec', '-T', 'web', 'bundle', 'install'], 'Ruby-Bundle-Install');

      // 2. Instalar paquetes de Node
      await this.runDockerCommand(['compose', 'exec', '-T', 'web', 'yarn', 'install', '--pure-lockfile'], 'Yarn-Install');

      // 3. Crear base de datos e inicializar tablas (db:initial_setup)
      await this.runDockerCommand([
        'compose', 'exec', '-T',
        '-e', 'CANVAS_LMS_ADMIN_EMAIL=admin@canvas.local',
        '-e', 'CANVAS_LMS_ADMIN_PASSWORD=adminpassword123',
        '-e', 'CANVAS_LMS_ACCOUNT_NAME=CanvasLocal',
        '-e', 'CANVAS_LMS_STATS_COLLECTION=opt_out',
        'web', 'bundle', 'exec', 'rake', 'db:initial_setup'
      ], 'Database-Initial-Setup');

      // 4. Compilar assets frontend (canvas:compile_assets_dev)
      await this.runDockerCommand(['compose', 'exec', '-T', 'web', 'bundle', 'exec', 'rake', 'canvas:compile_assets_dev'], 'Compile-Assets-Dev');

      console.log('[CanvasLocalManager] ¡Inicialización de Canvas LMS terminada con éxito!');
      return true;
    } catch (error) {
      console.error('[CanvasLocalManager] Falló la inicialización de Canvas:', error.message);
      throw error;
    }
  }

  /**
   * Actualiza el archivo .env del plugin con el Client ID de LTI generado, URL local y Token.
   */
  static updatePluginEnv(clientId, apiToken = null) {
    const pluginEnvPath = path.resolve(__dirname, '../../.env');
    console.log(`[CanvasLocalManager] Actualizando .env del Plugin en: ${pluginEnvPath}`);
    try {
      if (!fs.existsSync(pluginEnvPath)) {
        console.error(`[CanvasLocalManager] ERROR: No se encontró el archivo .env del plugin en ${pluginEnvPath}`);
        return false;
      }
      
      let envContent = fs.readFileSync(pluginEnvPath, 'utf8');
      
      // Reemplazar LTI_CLIENT_ID
      if (envContent.includes('LTI_CLIENT_ID=')) {
        envContent = envContent.replace(/LTI_CLIENT_ID=.*/g, `LTI_CLIENT_ID=${clientId}`);
      } else {
        envContent += `\nLTI_CLIENT_ID=${clientId}`;
      }

      // Reemplazar VITE_CANVAS_BASE_URL
      if (envContent.includes('VITE_CANVAS_BASE_URL=')) {
        envContent = envContent.replace(/VITE_CANVAS_BASE_URL=.*/g, `VITE_CANVAS_BASE_URL=http://localhost:8080`);
      } else {
        envContent += `\nVITE_CANVAS_BASE_URL=http://localhost:8080`;
      }

      // Reemplazar CANVAS_OIDC_URL
      if (envContent.includes('CANVAS_OIDC_URL=')) {
        envContent = envContent.replace(/CANVAS_OIDC_URL=.*/g, `CANVAS_OIDC_URL=http://localhost:8080/api/lti/authorize_redirect`);
      } else {
        envContent += `\nCANVAS_OIDC_URL=http://localhost:8080/api/lti/authorize_redirect`;
      }
      
      // Reemplazar VITE_CANVAS_ACCESS_TOKEN
      if (apiToken) {
        if (envContent.includes('VITE_CANVAS_ACCESS_TOKEN=')) {
          envContent = envContent.replace(/VITE_CANVAS_ACCESS_TOKEN=.*/g, `VITE_CANVAS_ACCESS_TOKEN=${apiToken}`);
        } else {
          envContent += `\nVITE_CANVAS_ACCESS_TOKEN=${apiToken}`;
        }
        process.env.VITE_CANVAS_ACCESS_TOKEN = apiToken;
      }

      fs.writeFileSync(pluginEnvPath, envContent);
      console.log(`[CanvasLocalManager] Archivo .env actualizado con LTI_CLIENT_ID=${clientId}`);
      return true;
    } catch (error) {
      console.error('[CanvasLocalManager] Error actualizando el .env del plugin:', error.message);
      return false;
    }
  }

  /**
   * Genera el script Ruby, lo inyecta en Canvas y corre la configuración LTI y datos dummy.
   */
  static setupLtiAndMockData() {
    return new Promise((resolve, reject) => {
      console.log('[CanvasLocalManager] Iniciando configuración de LTI y datos dummy...');
      
      const rubyScript = `# frozen_string_literal: true
puts "Creando usuarios ficticios..."

def get_or_create_user(email, name, password)
  pseudonym = Account.default.pseudonyms.active.by_unique_id(email).first
  user = pseudonym ? pseudonym.user : User.create!(name: name)
  user.register! unless user.registered?
  unless pseudonym
    pseudonym = user.pseudonyms.create!(
      unique_id: email,
      password: password,
      password_confirmation: password,
      account: Account.default
    )
    user.communication_channels.create!(path: email) { |cc| cc.workflow_state = "active" }
  end
  user
end

teacher = get_or_create_user("teacher@canvas.local", "Profesor de Prueba", "teacherpassword123")
student = get_or_create_user("student@canvas.local", "Estudiante de Prueba", "studentpassword123")

puts "Creando curso de prueba..."
course = Course.where(course_code: "PRUEBA-101").first
unless course
  course = Course.create!(name: "Curso de Prueba", course_code: "PRUEBA-101", account: Account.default)
  course.offer!
end

puts "Matriculando usuarios..."
course.enroll_user(teacher, 'TeacherEnrollment', enrollment_state: 'active') unless course.teachers.include?(teacher)
course.enroll_user(student, 'StudentEnrollment', enrollment_state: 'active') unless course.students.include?(student)

puts "Creando tarea..."
assignment = course.assignments.where(title: "Tarea de Prueba").first
unless assignment
  assignment = course.assignments.create!(title: "Tarea de Prueba", points_possible: 100)
end

puts "Registrando Developer Key LTI 1.3..."
key = DeveloperKey.where(name: "Plugin Feedback LTI").first
unless key
  key = DeveloperKey.create!(
    name: "Plugin Feedback LTI",
    email: "admin@canvas.local",
    redirect_uris: ["http://localhost:3000/api/lti/callback"],
    oidc_initiation_url: "http://localhost:3000/api/lti/login",
    client_type: "confidential"
  )
  key.generate_rsa_keypair!(overwrite: true)
  key.save!
  
  binding = DeveloperKeyAccountBinding.find_or_create_by!(
    developer_key: key,
    account: Account.default
  )
  binding.workflow_state = "on"
  binding.save!

  Lti::ToolConfiguration.create!(
    developer_key: key,
    settings: {
      title: "Feedback Adaptativo",
      description: "Plugin de Feedback Adaptativo con IA",
      target_link_uri: "http://localhost:3000/",
      oidc_initiation_url: "http://localhost:3000/api/lti/login",
      public_jwk: key.public_jwk,
      custom_fields: {
        canvas_course_id: "$Canvas.course.id",
        canvas_assignment_id: "$Canvas.assignment.id",
        canvas_user_id: "$Canvas.user.id",
        canvas_user_login_id: "$Canvas.user.loginId"
      },
      extensions: [
        {
          platform: "canvas.instructure.com",
          privacy_level: "public",
          settings: {
            placements: [
              {
                placement: "assignment_selection",
                target_link_uri: "http://localhost:3000/",
                message_type: "LtiDeepLinkingRequest"
              },
              {
                placement: "course_navigation",
                target_link_uri: "http://localhost:3000/",
                default_width: 800,
                default_height: 600,
                visibility: "admins"
              }
            ]
          }
        }
      ]
    }
  )
end

puts "=== LTI CONFIGURATION ==="
puts "LTI_CLIENT_ID:#{key.global_id}"
puts "=== CANVAS DATA ==="
puts "COURSE_ID:#{course.id}"
puts "ASSIGNMENT_ID:#{assignment.id}"
puts "TEACHER_EMAIL:teacher@canvas.local"
puts "STUDENT_EMAIL:student@canvas.local"
token = teacher.access_tokens.where(purpose: "Local Dev Token").first
unless token
  token = teacher.access_tokens.create!(purpose: "Local Dev Token", developer_key: DeveloperKey.default)
end
puts "CANVAS_API_TOKEN:#{token.full_token}"
puts "========================="
`;

      try {
        const tmpDir = path.join(CANVAS_PATH, 'tmp');
        if (!fs.existsSync(tmpDir)) {
          fs.mkdirSync(tmpDir, { recursive: true });
        }
        const scriptPath = path.join(tmpDir, 'setup_lti_and_data.rb');
        fs.writeFileSync(scriptPath, rubyScript);
        console.log('[CanvasLocalManager] Script Ruby escrito en: tmp/setup_lti_and_data.rb');

        // Copiar el script dentro del contenedor Docker (tmp/ del host no siempre está montado)
        console.log('[CanvasLocalManager] Copiando script al contenedor Docker...');
        try {
          execSync('docker compose cp tmp/setup_lti_and_data.rb web:/usr/src/app/tmp/setup_lti_and_data.rb', { cwd: CANVAS_PATH, stdio: 'ignore' });
        } catch (cpErr) {
          console.error('[CanvasLocalManager] Error copiando script al contenedor:', cpErr.message);
          return reject(cpErr);
        }

        console.log('[CanvasLocalManager] Ejecutando script de Ruby en Canvas... (Ver logs/docker_canvas.log)');

        const dockerProcess = spawn('docker', ['compose', 'exec', '-T', 'web', 'bundle', 'exec', 'rails', 'runner', 'tmp/setup_lti_and_data.rb'], {
          cwd: CANVAS_PATH
        });

        let stdoutBuffer = '';

        dockerProcess.stdout.on('data', (data) => {
          const text = data.toString();
          stdoutBuffer += text;
          writeDockerLog('[LTI-Setup-Stdout]', data);
        });

        dockerProcess.stderr.on('data', (data) => {
          writeDockerLog('[LTI-Setup-Stderr]', data);
        });

        dockerProcess.on('close', (code) => {
          if (code === 0) {
            console.log('[CanvasLocalManager] Script Ruby ejecutado con éxito.');
            
            const matchLTI = stdoutBuffer.match(/LTI_CLIENT_ID:(\d+)/);
            const matchToken = stdoutBuffer.match(/CANVAS_API_TOKEN:([a-zA-Z0-9~_-]+)/);
            
            if (matchLTI && matchLTI[1]) {
              const clientId = matchLTI[1];
              const apiToken = matchToken && matchToken[1] ? matchToken[1] : null;
              
              console.log(`[CanvasLocalManager] ID de Cliente LTI encontrado: ${clientId}`);
              if (apiToken) console.log(`[CanvasLocalManager] Token API encontrado: ${apiToken}`);
              
              this.updatePluginEnv(clientId, apiToken);
              resolve(clientId);
            } else {
              console.warn('[CanvasLocalManager] No se pudo encontrar LTI_CLIENT_ID en la salida del script.');
              resolve(null);
            }
          } else {
            console.error(`[CanvasLocalManager] El script de LTI terminó con código de error ${code}.`);
            reject(new Error(`El script de LTI falló con código ${code}`));
          }
        });

        dockerProcess.on('error', (err) => {
          console.error('[CanvasLocalManager] Error ejecutando rails runner:', err.message);
          reject(err);
        });

      } catch (error) {
        console.error('[CanvasLocalManager] Error configurando script Ruby:', error.message);
        reject(error);
      }
    });
  }

  static isCanvasRunning() {
    try {
      const output = execSync('docker compose ps --services --filter "status=running"', { cwd: CANVAS_PATH, encoding: 'utf8' });
      return output.includes('web');
    } catch (e) {
      return false;
    }
  }

  static isCanvasInitialized() {
    try {
      // Run rails runner inside the web container to check if our LTI key exists
      const output = execSync('docker compose exec -T web bundle exec rails runner "puts DeveloperKey.where(name: \'Plugin Feedback LTI\').exists?"', { cwd: CANVAS_PATH, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      return output.includes('true');
    } catch (e) {
      return false;
    }
  }

  static async autoStartAndInitialize() {
    console.log('[CanvasLocalManager] Verificando estado del entorno local de Canvas...');
    
    if (!this.checkDocker()) {
      throw new Error('Docker no está en ejecución. Por favor, inicia Docker Desktop y activa WSL2.');
    }

    const running = this.isCanvasRunning();
    if (!running) {
      console.log('[CanvasLocalManager] Canvas no está en ejecución. Iniciando contenedores...');
      await this.startCanvas();
      // Esperar 8 segundos a que los contenedores estén completamente arriba
      await new Promise(r => setTimeout(r, 8000));
    } else {
      console.log('[CanvasLocalManager] Los contenedores de Canvas ya están en ejecución.');
    }

    let initialized = false;
    try {
      initialized = this.isCanvasInitialized();
    } catch (e) {
      // Ignorar, se asume no inicializado
    }

    if (!initialized) {
      console.log('[CanvasLocalManager] Se detectó que Canvas no está inicializado. Iniciando pipeline automático de base de datos y assets...');
      await this.initializeCanvas();
      await this.setupLtiAndMockData();
    } else {
      console.log('[CanvasLocalManager] Canvas local ya está completamente inicializado y configurado.');
      
      // Intentar recuperar el Client ID y el token y actualizar el .env por seguridad
      try {
        const getClientIdCmd = "docker compose exec -T web bundle exec rails runner 'puts DeveloperKey.where(name: \"Plugin Feedback LTI\").first.global_id'";
        const clientId = execSync(getClientIdCmd, { cwd: CANVAS_PATH, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
        const matchLTI = clientId.match(/(\d+)/);
        
        const getTokenCmd = "docker compose exec -T web bundle exec rails runner 'user = User.where(name: \"Profesor de Prueba\").first; puts user ? user.access_tokens.where(purpose: \"Local Dev Token\").first&.full_token : \"\"'";
        const tokenOutput = execSync(getTokenCmd, { cwd: CANVAS_PATH, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
        const apiToken = tokenOutput.length > 0 ? tokenOutput : null;

        if (matchLTI && matchLTI[1]) {
          this.updatePluginEnv(matchLTI[1], apiToken);
        }
      } catch (e) {
        console.warn('[CanvasLocalManager] No se pudo recuperar el ID de Cliente LTI / Token existente:', e.message);
      }
    }
    return true;
  }
}

export default CanvasLocalManager;
