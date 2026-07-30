/**
 * FileManager.js
 *
 * Utilidades para leer y escribir archivos de configuración local de forma segura.
 *
 * Principios aplicados:
 * - Escritura atómica: se escribe primero a un archivo .tmp y luego se hace fs.rename,
 *   de manera que si el proceso se interrumpe no queda un archivo a medias o corrompido.
 * - Manejo explícito de errores: nunca se silencian errores con `catch {}` vacío.
 * - Respeto de saltos de línea multiplataforma (CRLF en Windows, LF en Linux).
 */

import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Lee y parsea un archivo JSON de forma segura.
 * Si el archivo no existe o tiene formato inválido, devuelve `defaultValue` y
 * registra un warning describiendo el problema.
 *
 * @param {string} filePath - Ruta absoluta al archivo JSON.
 * @param {any} defaultValue - Valor a devolver si el archivo no existe o está corrompido.
 * @param {Function} [log] - Función de log opcional (ej. boot.warn).
 * @returns {Promise<any>}
 */
export async function safeReadJSON(filePath, defaultValue = {}, log = null) {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === 'ENOENT') {
      // El archivo no existe — esto es normal en el primer arranque
      if (log) log(`[FILE-MANAGER] ${path.basename(filePath)} no existe. Se usará estructura vacía.`);
    } else if (e instanceof SyntaxError) {
      // El archivo existe pero tiene JSON malformado
      if (log) log(`[FILE-MANAGER] WARN: ${path.basename(filePath)} tiene formato JSON inválido. Usando estructura por defecto. Error: ${e.message}`);
    } else {
      if (log) log(`[FILE-MANAGER] ERROR leyendo ${path.basename(filePath)}: ${e.message}`);
    }
    return defaultValue;
  }
}

/**
 * Serializa y escribe datos en un archivo JSON de forma atómica.
 * Escribe primero a un archivo temporal (.tmp) y luego hace rename,
 * garantizando que el archivo original no quede corrupto en caso de fallo.
 *
 * @param {string} filePath - Ruta absoluta al archivo JSON destino.
 * @param {any} data - Datos a serializar y guardar.
 * @param {Function} [log] - Función de log opcional.
 * @returns {Promise<void>}
 */
export async function safeWriteJSON(filePath, data, log = null) {
  const tmpPath = `${filePath}.tmp`;
  try {
    const serialized = JSON.stringify(data, null, 2);
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    await fs.writeFile(tmpPath, serialized, 'utf-8');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    await fs.rename(tmpPath, filePath);
  } catch (e) {
    if (log) log(`[FILE-MANAGER] ERROR escribiendo ${path.basename(filePath)}: ${e.message}`);
    // Limpiar el temporal si quedó
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    await fs.unlink(tmpPath).catch(() => {});
    throw e;
  }
}

/**
 * Lee el archivo `.env`, actualiza una variable clave=valor y lo escribe de vuelta.
 * Respeta saltos de línea CRLF (Windows) y LF (Linux/macOS).
 * Si la clave no existe, la agrega al final del archivo.
 *
 * @param {string} envFilePath - Ruta absoluta al archivo .env.
 * @param {string} key - Nombre de la variable a actualizar.
 * @param {string} value - Nuevo valor de la variable.
 * @param {Function} [log] - Función de log opcional.
 * @returns {Promise<void>}
 */
export async function safeUpdateEnvVariable(envFilePath, key, value, log = null) {
  let content = '';
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    content = await fs.readFile(envFilePath, 'utf-8');
  } catch (e) {
    if (e.code !== 'ENOENT') {
      if (log) log(`[FILE-MANAGER] ERROR leyendo .env en ${envFilePath}: ${e.message}`);
      throw e;
    }
    // Si el archivo no existe, se creará
  }

  // Detectar el tipo de salto de línea dominante para preservarlo
  const lineEnding = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(/\r?\n/);

  let updated = false;
  for (let i = 0; i < lines.length; i++) {
    // eslint-disable-next-line security/detect-object-injection
    if (lines[i].startsWith(`${key}=`)) {
      // eslint-disable-next-line security/detect-object-injection
      lines[i] = `${key}=${value}`;
      updated = true;
      break;
    }
  }

  if (!updated) {
    // Evitar línea vacía doble al final
    if (lines[lines.length - 1] === '') {
      lines.splice(lines.length - 1, 0, `${key}=${value}`);
    } else {
      lines.push(`${key}=${value}`);
    }
  }

  const newContent = lines.join(lineEnding);

  try {
    const tmpPath = `${envFilePath}.tmp`;
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    await fs.writeFile(tmpPath, newContent, 'utf-8');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    await fs.rename(tmpPath, envFilePath);
    if (log) log(`[FILE-MANAGER] Variable ${key} actualizada en .env`);
  } catch (e) {
    if (log) log(`[FILE-MANAGER] ERROR escribiendo .env: ${e.message}. Verifica permisos de escritura en ${envFilePath}`);
    throw e;
  }
}
