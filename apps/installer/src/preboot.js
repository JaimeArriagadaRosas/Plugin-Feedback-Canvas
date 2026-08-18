import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.getuid && process.getuid() === 0) {
  console.error('\n[X] FATAL ERROR: The installer must not be run as root/sudo.');
  console.error('    Run npm start with your normal user. Host operations');
  console.error('    that require elevation will prompt for sudo when needed.');
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..', '..');

const nmPath = path.join(rootDir, 'node_modules');
function getPackageManagerSpec() {
  const packageJsonPath = path.join(rootDir, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  return packageJson.packageManager || 'npm@11.8.0';
}

export function getPackageManagerCommand(manager, platform = process.platform) {
  const installArgs = [
    '--yes',
    manager,
    'ci',
    '--no-fund',
    '--no-audit',
    '--loglevel=error'
  ];

  if (platform === 'win32') {
    return {
      command: process.env.ComSpec || 'cmd.exe',
      args: ['/d', '/c', 'npx.cmd', ...installArgs]
    };
  }

  return {
    command: 'npx',
    args: installArgs
  };
}

function installLockedDependencies() {
  if (process.env.PLUGIN_DEP_REPAIR_ATTEMPTED === 'true') {
    console.error('\n[X] Dependency repair already attempted once. Check package-lock.json and npm log.');
    process.exit(1);
  }

  const manager = getPackageManagerSpec();
  const { command, args } = getPackageManagerCommand(manager);
  
  console.warn(`\n[!] Installing locked dependencies with ${manager}. This may take a few minutes...`);
  const result = spawnSync(command, args, { cwd: rootDir, stdio: 'inherit', shell: false });
  if (result.error) {
    console.error('\n[X] Package manager execution failed:', result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error('\n[X] Dependency installation failed.');
    process.exit(1);
  }
  console.log('\n[√] Dependencies installed successfully from package-lock.json.\n');
}

// 1. Verificación estática inicial rápida
import { createRequire } from 'node:module';
const requireLocal = createRequire(import.meta.url);

function isFastCheckPassing() {
  try {
    const pkgs = [
      path.join(rootDir, 'package.json'),
      path.join(rootDir, 'packages', 'logger', 'package.json'),
      path.join(rootDir, 'packages', 'contracts', 'package.json'),
      path.join(rootDir, 'packages', 'canvas-api', 'package.json'),
      path.join(rootDir, 'packages', 'plugin-database', 'package.json'),
      path.join(rootDir, 'apps', 'installer', 'package.json'),
      path.join(rootDir, 'apps', 'server', 'package.json'),
      path.join(rootDir, 'apps', 'client', 'package.json')
    ];
    for (const p of pkgs) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      if (!fs.existsSync(p)) continue;
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const json = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (json.dependencies) {
        for (const dep of Object.keys(json.dependencies)) {
          if (dep.startsWith('@') && !dep.includes('/')) continue; // Ignorar alias internos simples
          const depName = dep.startsWith('@') ? dep.split('/').slice(0,2).join('/') : dep.split('/')[0];
          
          try {
            // Evaluamos exactamente como Node.js resolvería este módulo desde el directorio de su respectivo package.json
            requireLocal.resolve(depName, { paths: [path.dirname(p)] });
          } catch (err) {
            console.warn(`\n[!] Missing dependency detected before boot: ${depName}`);
            return false;
          }
        }
      }
    }
    return true;
  } catch (e) {
    return true; // Fallback al import dinámico si algo falla al leer los JSON
  }
}

if (!fs.existsSync(nmPath) || !isFastCheckPassing()) {
  installLockedDependencies();
  restartApp(); // Reiniciar para que Node limpie su caché de módulos tras instalar
}

function restartApp() {
  const args = process.argv.slice(2);
  const result = spawnSync(process.execPath, [__filename, ...args], {
    cwd: rootDir,
    stdio: 'inherit',
    env: { ...process.env, PLUGIN_DEP_REPAIR_ATTEMPTED: 'true' }
  });
  process.exit(result.status ?? 1);
}

// 2. Interceptar errores asíncronos de módulos corruptos (ej: hilos de Pino)
process.on('uncaughtException', (err) => {
  if (err.message && (err.message.includes('Cannot find module') || err.message.includes('ERR_MODULE_NOT_FOUND'))) {
    console.warn('\n[!] Corrupt dependency detected in async execution.');
    console.warn(`[!] Original error: ${err.message}`);
    installLockedDependencies();
    restartApp();
  } else {
    console.error(err);
    process.exit(1);
  }
});

// 3. Ejecutar aplicación principal
async function boot() {
  try {
    await import('./index.js');
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND' || (err.message && err.message.includes('Cannot find module'))) {
       console.warn('\n[!] Missing dependency detected when loading modules.');
       console.warn(`[!] Original error: ${err.message}`);
       installLockedDependencies();
       restartApp();
    } else {
      console.error(err);
      process.exit(1);
    }
  }
}

boot();
