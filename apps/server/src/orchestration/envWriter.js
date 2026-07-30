import * as fs from 'node:fs';
import * as path from 'node:path';

export function getEnvVar(pluginDir, key) {
  const envPath = path.resolve(pluginDir, '.env');
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (fs.existsSync(envPath)) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const envContent = fs.readFileSync(envPath, 'utf8');
    // eslint-disable-next-line security/detect-non-literal-regexp
    const match = envContent.match(new RegExp(`^${key}=(.*)`, 'm'));
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

export function updateEnvVars(pluginDir, variables) {
  const envPath = path.resolve(pluginDir, '.env');
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const lines = envContent.split('\n');

  for (const [key, value] of Object.entries(variables)) {
    if (value === undefined || value === null) continue;
    const index = lines.findIndex(l => l.startsWith(`${key}=`));
    if (index !== -1) {
      // eslint-disable-next-line security/detect-object-injection
      lines[index] = `${key}=${value}`;
    } else {
      lines.push(`${key}=${value}`);
    }
  }
  
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  fs.writeFileSync(envPath, lines.join('\n'), 'utf8');
  console.log(`  · Variables de entorno actualizadas en .env`);

  // SOLID: Disparar recarga en caliente del archivo modificado
  import('../services/config/ConfigManager.js')
    .then(configManager => {
      if (configManager.default && typeof configManager.default.reload === 'function') {
        configManager.default.reload();
        console.log(`  · [Hot-Reload] ConfigManager sincronizado con el nuevo .env`);
      }
    })
    .catch(e => {
      console.warn(`  · [Hot-Reload] No se pudo recargar ConfigManager automáticamente: ${e.message}`);
    });
}

export function writeEnvOverrides(pluginDir, mode, useLocalData = true, role = 'admin') {
  const envPath = path.resolve(pluginDir, '.env');
  let env = '';
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (fs.existsSync(envPath)) env = fs.readFileSync(envPath, 'utf8');
  const lines = env.split('\n').filter(l => !l.startsWith('MOCK_USER_ROLE=') && !l.startsWith('LOCAL_USER_ROLE=') && !l.startsWith('VITE_USE_MOCK_DATA=') && !l.startsWith('VITE_USE_LOCAL_DATA=') && !l.startsWith('STARTUP_MODE=') && !l.startsWith('NON_INTERACTIVE=') && !l.startsWith('USE_LOCAL_DATA='));
  
  if (mode === '1' || mode === '2') {
    lines.push('USE_LOCAL_DATA=false');
    lines.push('VITE_USE_LOCAL_DATA=false');
    console.log(`  · Variables de entorno configuradas (modo: ${mode}, local_data: false).`);
  } else if (mode === '3') {
    lines.push('USE_LOCAL_DATA=false');
    lines.push('VITE_USE_LOCAL_DATA=false');
    console.log(`  · Variables de entorno configuradas (modo: 3, local_data: false).`);
  } else {
    lines.push(`USE_LOCAL_DATA=${useLocalData}`);
    lines.push(`VITE_USE_LOCAL_DATA=${useLocalData}`);
    console.log(`  · Variables de entorno configuradas (modo: ${mode}, local_data: ${useLocalData}).`);
  }
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  fs.writeFileSync(envPath, lines.join('\n') + '\n', 'utf8');
}
