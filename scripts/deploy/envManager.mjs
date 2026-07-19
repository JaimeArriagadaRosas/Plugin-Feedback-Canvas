import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import pc from 'picocolors';

/**
 * Módulo para leer y modificar el archivo .env de forma dinámica.
 */

export async function ensureEnvConfigured(pluginDir, configData) {
  const envPath = path.join(pluginDir, '.env');
  const envExamplePath = path.join(pluginDir, 'env_example');

  let envContent = '';

  try {
    envContent = await fs.readFile(envPath, 'utf8');
    console.log(pc.blue('ℹ️ Archivo .env existente encontrado. Se actualizarán sus valores.'));
  } catch (e) {
    console.log(pc.blue('ℹ️ No existe .env. Creando a partir de env_example...'));
    try {
      envContent = await fs.readFile(envExamplePath, 'utf8');
    } catch (err) {
      throw new Error('No se encontró el archivo env_example. Asegúrese de que el proyecto esté completo.');
    }
  }

  // Generar secretos si no existen o forzar si estamos en setup nuevo
  const encryptionKey = crypto.randomBytes(32).toString('hex');
  const webhookSecret = crypto.randomBytes(32).toString('hex');

  const updates = {
    'CANVAS_BASE_URL': configData.canvasUrl,
    'CANVAS_ISSUER': configData.canvasUrl,
    'FRONTEND_URL': configData.domain,
    'VITE_BACKEND_URL': configData.domain,
    'HTTPS': 'true',
    'USE_LOCAL_DATA': 'false',
    'VITE_USE_LOCAL_DATA': 'false',
    'STARTUP_MODE': '1' // Por defecto lo forzamos a 1 (producción) tras el setup
  };

  // Agregar developer key y token de admin si se provió
  if (configData.developerKeyId) updates['LTI_CLIENT_ID'] = configData.developerKeyId;
  if (configData.canvasToken) updates['CANVAS_ACCESS_TOKEN'] = configData.canvasToken;
  
  // Procesar líneas y reemplazar
  const lines = envContent.split('\n');
  const updatedLines = lines.map(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed.includes('=')) return line;
    
    const [key] = line.split('=');
    const cleanKey = key.trim();

    // Actualizaciones directas
    if (updates[cleanKey] !== undefined) {
      return `${cleanKey}=${updates[cleanKey]}`;
    }

    // Si las claves de encriptación están vacías o en placeholder, llenarlas
    if (cleanKey === 'ENCRYPTION_KEY' && (line.includes('your_encryption_key_here') || line.split('=')[1].trim() === '')) {
      return `ENCRYPTION_KEY=${encryptionKey}`;
    }
    if (cleanKey === 'WEBHOOK_SECRET' && (line.includes('your_webhook_secret_here') || line.split('=')[1].trim() === '')) {
      return `WEBHOOK_SECRET=${webhookSecret}`;
    }

    return line;
  });

  // Si LTI_CLIENT_ID no estaba en el archivo base (ej. estaba comentado) pero tenemos actualizaciones, lo apendamos.
  for (const [k, v] of Object.entries(updates)) {
    const exists = updatedLines.some(l => l.trim().startsWith(`${k}=`));
    if (!exists) {
      updatedLines.push(`${k}=${v}`);
    }
  }

  await fs.writeFile(envPath, updatedLines.join('\n'), 'utf8');
  console.log(pc.green('✅ Archivo .env configurado exitosamente con secretos generados.'));
}
