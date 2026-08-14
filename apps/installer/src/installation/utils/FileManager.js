/**
 * FileManager.js
 *
 * Utilities to safely read and write local configuration files.
 *
 * Applied principles:
 * - Atomic writing: write first to a .tmp file and then use fs.rename,
 *   so that if the process is interrupted, an incomplete or corrupted file does not remain.
 * - Explicit error handling: errors are never silenced with an empty `catch {}`.
 * - Respect for cross-platform line breaks (CRLF on Windows, LF on Linux).
 */

import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Safely reads and parses a JSON file.
 * If the file does not exist or has an invalid format, returns `defaultValue` and
 * logs a warning describing the problem.
 *
 * @param {string} filePath - Absolute path to the JSON file.
 * @param {any} defaultValue - Value to return if the file does not exist or is corrupted.
 * @param {Function} [log] - Optional log function (e.g. boot.warn).
 * @returns {Promise<any>}
 */
export async function safeReadJSON(filePath, defaultValue = {}, log = null) {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === 'ENOENT') {
      // The file does not exist — this is normal on the first boot
      if (log) log(`[FILE-MANAGER] ${path.basename(filePath)} does not exist. An empty structure will be used.`);
    } else if (e instanceof SyntaxError) {
      // The file exists but has malformed JSON
      if (log) log(`[FILE-MANAGER] WARN: ${path.basename(filePath)} has an invalid JSON format. Using default structure. Error: ${e.message}`);
    } else {
      if (log) log(`[FILE-MANAGER] ERROR reading ${path.basename(filePath)}: ${e.message}`);
    }
    return defaultValue;
  }
}

/**
 * Serializes and writes data to a JSON file atomically.
 * Writes first to a temporary file (.tmp) and then renames it,
 * ensuring the original file is not corrupted in case of failure.
 *
 * @param {string} filePath - Absolute path to the destination JSON file.
 * @param {any} data - Data to serialize and save.
 * @param {Function} [log] - Optional log function.
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
    if (log) log(`[FILE-MANAGER] ERROR writing ${path.basename(filePath)}: ${e.message}`);
    // Clean up the temporary file if it remained
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    await fs.unlink(tmpPath).catch(e => { console.debug('Error unlinking temp file', e.message); });
    throw e;
  }
}

/**
 * Reads the `.env` file, updates a key=value variable and writes it back.
 * Respects CRLF (Windows) and LF (Linux/macOS) line breaks.
 * If the key does not exist, it adds it to the end of the file.
 *
 * @param {string} envFilePath - Absolute path to the .env file.
 * @param {string} key - Name of the variable to update.
 * @param {string} value - New value for the variable.
 * @param {Function} [log] - Optional log function.
 * @returns {Promise<void>}
 */
export async function safeUpdateEnvVariable(envFilePath, key, value, log = null) {
  let content = '';
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    content = await fs.readFile(envFilePath, 'utf-8');
  } catch (e) {
    if (e.code !== 'ENOENT') {
      if (log) log(`[FILE-MANAGER] ERROR reading .env at ${envFilePath}: ${e.message}`);
      throw e;
    }
    // If the file does not exist, it will be created
  }

  // Detect the dominant line break type to preserve it
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
    // Avoid double empty line at the end
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
    if (log) log(`[FILE-MANAGER] Variable ${key} updated in .env`);
  } catch (e) {
    if (log) log(`[FILE-MANAGER] ERROR writing .env: ${e.message}. Check write permissions at ${envFilePath}`);
    throw e;
  }
}
