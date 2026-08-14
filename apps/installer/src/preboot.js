import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..', '..');

const nmPath = path.join(rootDir, 'node_modules');
function getPackageManagerSpec() {
  const packageJsonPath = path.join(rootDir, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  return packageJson.packageManager || 'npm@11.8.0';
}

function installLockedDependencies() {
  if (process.env.PLUGIN_DEP_REPAIR_ATTEMPTED === 'true') {
    console.error('\n[X] Dependency repair has already been attempted once. Please check package-lock.json and the npm log.');
    process.exit(1);
  }

  const manager = getPackageManagerSpec();
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  console.warn(`\n[!] Installing locked dependencies with ${manager}. This may take a few minutes...`);
  const result = spawnSync(npx, [
    '--yes', manager, 'ci', '--no-fund', '--no-audit', '--loglevel=error'
  ], { cwd: rootDir, stdio: 'inherit', shell: false });
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

// 1. Fast initial static check
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
          if (dep.startsWith('@') && !dep.includes('/')) continue; // Skip simple internal aliases
          const depName = dep.startsWith('@') ? dep.split('/').slice(0,2).join('/') : dep.split('/')[0];
          
          try {
            // Resolve exactly as Node.js would from the package.json directory
            requireLocal.resolve(depName, { paths: [path.dirname(p)] });
          } catch (err) {
            console.warn(`\n[!] Missing dependency detected before startup: ${depName}`);
            return false;
          }
        }
      }
    }
    return true;
  } catch (e) {
    return true; // Fallback to dynamic import if reading JSONs fails
  }
}

if (!fs.existsSync(nmPath) || !isFastCheckPassing()) {
  installLockedDependencies();
  restartApp(); // Restart so Node clears its module cache after install
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

// 2. Intercept async errors from corrupt modules (e.g. Pino worker threads)
process.on('uncaughtException', (err) => {
  if (err.message && (err.message.includes('Cannot find module') || err.message.includes('ERR_MODULE_NOT_FOUND'))) {
    console.warn('\n[!] Corrupt dependency detected during async execution.');
    console.warn(`[!] Original error: ${err.message}`);
    installLockedDependencies();
    restartApp();
  } else {
    console.error(err);
    process.exit(1);
  }
});

// 3. Launch main application
async function boot() {
  try {
    await import('./index.js');
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND' || (err.message && err.message.includes('Cannot find module'))) {
       console.warn('\n[!] Missing dependency detected while loading modules.');
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
