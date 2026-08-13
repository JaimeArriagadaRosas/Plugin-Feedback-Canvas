/**
 * TeacherTokenGenerator.js
 *
 * Responsable único de gestionar el token de API del profesor para el entorno local.
 *
 * Estrategia aplicada (alineada con producción):
 * - Primero valida el token existente (diferenciando error de red vs. token inválido).
 * - Si Canvas no está disponible (ECONNREFUSED), reintenta con backoff en lugar de
 *   destruir y regenerar el token innecesariamente.
 * - Si el token es genuinamente inválido (401), lo regenera usando la estrategia
 *   de archivo de handoff Docker (no stdout/Regex).
 * - Persiste el token ÚNICAMENTE en PostgreSQL vía CanvasTokenRepository (cifrado).
 *   Se elimina la copia en texto plano de perfiles_data.json.
 */

import path from 'node:path';
import { getCanvasDirectory, getPluginDirectory } from '../installation/utils/LocalWorkspacePaths.js';
import { validateToken, healTokenViaFile, withRetry } from '../installation/utils/TokenManager.js';
import { safeUpdateEnvVariable } from '../installation/utils/FileManager.js';
import { LocalTokenStore } from './LocalTokenStore.js';

const CANVAS_DIR = getCanvasDirectory();
const PLUGIN_ENV_PATH = path.join(getPluginDirectory(), '.env');

// Validez del token local: 1 año (entorno de desarrollo)
const LOCAL_TOKEN_EXPIRY_MS = 1000 * 60 * 60 * 24 * 365;

export class TeacherTokenGenerator {
  static async generate(spinner) {
    const log = (msg) => { if (spinner) spinner.clear(); console.log(`  · ${msg}`); };
    const warn = (msg) => { if (spinner) spinner.clear(); console.log(`  ! ${msg}`); };
    const error = (msg) => { if (spinner) spinner.clear(); console.log(`  × ${msg}`); };

    try {
      if (spinner) spinner.update({ text: 'Verificando token de API del profesor...' });

      const teacherEmail = process.env.CANVAS_TEACHER_EMAIL || 'profesor@canvas.local';
      const teacherFallbackName = process.env.CANVAS_TEACHER_NAME || 'Dr. Elena Ramirez';
      const existingToken = process.env.CANVAS_ACCESS_TOKEN || null;

      let tokenData = await this._validateExistingToken(existingToken, teacherEmail, spinner, log, warn);
      
      if (!tokenData) {
        tokenData = await this._regenerateToken(teacherEmail, teacherFallbackName, existingToken, spinner, log, warn);
      }

      await this._syncToDatabase(tokenData, teacherEmail, teacherFallbackName, spinner, log, warn);

      if (spinner) {
        spinner.success({ text: 'Configuración de token de profesor completada.', mark: '  √' });
      }

    } catch (e) {
      error(`Error fatal al gestionar el token del profesor: ${e.message}`);
      if (spinner) {
        spinner.warn({ text: `Advertencia: No se pudo gestionar el token del profesor. Error: ${e.message}`, mark: '  !' });
      } else {
        console.log(`  ! Advertencia: No se pudo gestionar el token del profesor. Error: ${e.message}`);
      }
    }
  }

  static async _validateExistingToken(existingToken, teacherEmail, spinner, log, warn) {
    if (!existingToken) {
      log(`No hay token en CANVAS_ACCESS_TOKEN. Generando por primera vez.`);
      return null;
    }

    log(`Validando token existente para ${teacherEmail}...`);
    const validation = await withRetry(
      () => validateToken(existingToken),
      3, 2000,
      (attempt, total, waitMs) => {
        if (spinner) spinner.update({ text: `Verificando token... (intento ${attempt}/${total})` });
        log(`Reintentando validación de token en ${waitMs}ms (intento ${attempt}/${total})`);
      }
    ).catch(e => ({ valid: false, reason: 'NETWORK_ERROR', error: e.message }));

    if (validation.reason === 'NETWORK_ERROR') {
      warn(`Canvas no responde (${validation.error}). Se asumirá que el token existente es válido.`);
      return { token: existingToken, canvas_sub: null, user_id: null, reused: true, networkError: true };
    } else if (validation.valid) {
      log(`Token existente validado correctamente (HTTP 200).`);
      return { token: existingToken, canvas_sub: null, user_id: null, reused: true };
    }
    
    log(`Token inválido (${validation.reason}, HTTP ${validation.status}). Procediendo a regenerar.`);
    return null;
  }

  static async _regenerateToken(teacherEmail, teacherFallbackName, existingToken, spinner, log, warn) {
    if (spinner) spinner.update({ text: 'Iniciando nueva sesión, regenerando token...' });

    const healed = await healTokenViaFile(
      CANVAS_DIR, teacherEmail, teacherFallbackName, existingToken, true
    );

    await safeUpdateEnvVariable(PLUGIN_ENV_PATH, 'CANVAS_ACCESS_TOKEN', healed.token, warn);
    process.env.CANVAS_ACCESS_TOKEN = healed.token;
    log(`Token regenerado y guardado en .env.`);
    
    return healed;
  }

  static async _syncToDatabase(tokenData, teacherEmail, teacherFallbackName, spinner, log, warn) {
    if (tokenData.networkError || !tokenData.token) {
      if (tokenData.networkError && spinner) {
        spinner.warn({ text: `Token asumido válido (Canvas no respondía). Se sincronizará en la próxima petición autenticada.`, mark: '  !' });
      }
      return;
    }

    try {
      let canvasSub = tokenData.canvas_sub;
      let userId = tokenData.user_id;

      if (tokenData.reused && !canvasSub) {
        const userData = await healTokenViaFile(
          CANVAS_DIR, teacherEmail, teacherFallbackName, tokenData.token, false
        );
        canvasSub = userData.canvas_sub;
        userId = userData.user_id;
      }

      if (canvasSub) {
        const store = new LocalTokenStore();
        try {
          const expiresAt = new Date(Date.now() + LOCAL_TOKEN_EXPIRY_MS);
          const tokenKey = userId ? String(userId) : canvasSub;
          await store.saveToken(tokenKey, tokenData.token, null, expiresAt);
          log(`Token sincronizado en PostgreSQL (token_key: ${tokenKey}, canvas_sub: ${canvasSub}, canvas_user_id: ${userId}).`);

          if (!spinner) {
            console.log(`  √ Token sincronizado en PostgreSQL (canvas_user_id=${userId}).`);
          }
        } finally {
          await store.close();
        }
      } else {
        warn(`No se pudo extraer canvas_sub para sincronizar en BD.`);
      }
    } catch (e) {
      if (e.message && e.message.includes('does not exist')) {
        log(`Migraciones pendientes. Se sincronizará el token luego.`);
      } else {
        warn(`No se pudo sincronizar el token del profesor. Error: ${e.message}`);
      }
    }
  }
}
