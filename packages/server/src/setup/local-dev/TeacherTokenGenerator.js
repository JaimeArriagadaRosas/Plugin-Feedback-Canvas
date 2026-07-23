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
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';
import { validateToken, healTokenViaFile, withRetry } from '../../orchestration/boot/setup/utils/TokenManager.js';
import { safeUpdateEnvVariable } from '../../orchestration/boot/setup/utils/FileManager.js';
import CanvasTokenRepository from '../../data/CanvasTokenRepository.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CANVAS_DIR = path.resolve(__dirname, '../../../../../../canvas-lms-master');
const PLUGIN_ENV_PATH = path.resolve(__dirname, '../../../../../.env');

// Validez del token local: 1 año (entorno de desarrollo)
const LOCAL_TOKEN_EXPIRY_MS = 1000 * 60 * 60 * 24 * 365;

export class TeacherTokenGenerator {
  /**
   * Valida o regenera el token del profesor y lo sincroniza en PostgreSQL.
   *
   * @param {import('nanospinner').Spinner|null} spinner
   */
  static async generate(spinner) {
    const log = (msg) => {
      if (spinner) spinner.clear();
      console.log(`    ${pc.blue('[TEACHER-TOKEN]')} ${msg}`);
    };
    const warn = (msg) => {
      if (spinner) spinner.clear();
      console.log(`    ${pc.yellow('[TEACHER-TOKEN]')} ${msg}`);
    };
    const error = (msg) => {
      if (spinner) spinner.clear();
      console.log(`    ${pc.red('[TEACHER-TOKEN]')} ${msg}`);
    };

    try {
      if (spinner) spinner.update({ text: 'Verificando token de API del profesor...' });

      const teacherEmail = process.env.CANVAS_TEACHER_EMAIL || 'profesor@canvas.local';
      const teacherFallbackName = process.env.CANVAS_TEACHER_NAME || 'Dr. Elena Ramirez';
      const existingToken = process.env.CANVAS_ACCESS_TOKEN || null;

      let tokenData = null;
      let wasRegenerated = false;

      // --- Paso 1: Intentar validar el token existente ---
      if (existingToken) {
        log(`Validando token existente para ${teacherEmail}...`);
        
        const validation = await withRetry(
          () => validateToken(existingToken),
          3,
          2000,
          (attempt, total, waitMs) => {
            if (spinner) spinner.update({ text: `Verificando token... (intento ${attempt}/${total})` });
            log(`Reintentando validación de token en ${waitMs}ms (intento ${attempt}/${total})`);
          }
        ).catch(e => ({ valid: false, reason: 'NETWORK_ERROR', error: e.message }));

        if (validation.reason === 'NETWORK_ERROR') {
          // Canvas no está disponible: no destruir el token, asumir que sigue siendo válido
          // y dejar que los reintentos de la capa LTI lo resuelvan.
          warn(`Canvas no responde (${validation.error}). Se asumirá que el token existente es válido.`);
          tokenData = { token: existingToken, canvas_sub: null, user_id: null, reused: true, networkError: true };
        } else if (validation.valid) {
          log(`Token existente validado correctamente (HTTP 200).`);
          tokenData = { token: existingToken, canvas_sub: null, user_id: null, reused: true };
        } else {
          // Token inválido (401): proceder a regenerar
          log(`Token inválido (${validation.reason}, HTTP ${validation.status}). Procediendo a regenerar.`);
        }
      } else {
        log(`No hay token en CANVAS_ACCESS_TOKEN. Generando por primera vez.`);
      }

      // --- Paso 2: Regenerar si no se pudo reutilizar ---
      if (!tokenData) {
        if (spinner) spinner.update({ text: 'Iniciando nueva sesión, regenerando token...' });

        const healed = await healTokenViaFile(
          CANVAS_DIR,
          teacherEmail,
          teacherFallbackName,
          existingToken,
          true // forceRegenerate
        );

        tokenData = healed;
        wasRegenerated = true;

        // Actualizar .env con el nuevo token para las próximas sesiones
        await safeUpdateEnvVariable(PLUGIN_ENV_PATH, 'CANVAS_ACCESS_TOKEN', healed.token, warn);
        // Actualizar process.env en memoria para el proceso actual
        process.env.CANVAS_ACCESS_TOKEN = healed.token;
        log(`Token regenerado y guardado en .env.`);
      }

      // --- Paso 3: Sincronizar en PostgreSQL (única fuente de verdad) ---
      // Solo sincronizar si tenemos datos completos del usuario (no en caso de error de red)
      if (!tokenData.networkError && tokenData.token) {
        try {
          // Obtener canvas_sub: si se reutilizó el token, necesitamos obtener el sub via archivo
          let canvasSub = tokenData.canvas_sub;
          let userId = tokenData.user_id;

          if (tokenData.reused && !canvasSub) {
            // Obtener el sub del usuario sin regenerar el token
            const userData = await healTokenViaFile(
              CANVAS_DIR,
              teacherEmail,
              teacherFallbackName,
              tokenData.token,
              false // NO regenerar, solo obtener datos del usuario
            );
            canvasSub = userData.canvas_sub;
            userId = userData.user_id;
          }

          if (canvasSub) {
            const repo = new CanvasTokenRepository();
            const expiresAt = new Date(Date.now() + LOCAL_TOKEN_EXPIRY_MS);
            await repo.saveToken(canvasSub, tokenData.token, null, expiresAt);
            log(`Token sincronizado en PostgreSQL (canvas_sub: ${canvasSub}, canvas_user_id: ${userId}).`);

            if (spinner) {
              spinner.success({
                text: `Token del profesor listo (canvas_user_id=${userId}, ${wasRegenerated ? 'regenerado' : 'reutilizado'}). Sincronizado en PostgreSQL.`,
                mark: '  √'
              });
            } else {
              console.log(`    ${pc.green('[TEACHER-TOKEN]')} Token del profesor listo (canvas_user_id=${userId}). Sincronizado en PostgreSQL.`);
            }
          } else {
            warn(`No se pudo obtener canvas_sub. Token listo pero NO sincronizado en DB.`);
            if (spinner) spinner.warn({ text: `Token listo pero sin sincronización en DB (canvas_sub no disponible).`, mark: '  !' });
          }
        } catch (dbErr) {
          warn(`No se pudo sincronizar el token en PostgreSQL: ${dbErr.message}`);
          if (spinner) spinner.warn({ text: `Token listo, pero falló la sincronización en DB: ${dbErr.message}`, mark: '  !' });
        }
      } else if (tokenData.networkError) {
        // Canvas no respondió — advertencia pero no falla el arranque
        if (spinner) spinner.warn({ text: `Token asumido válido (Canvas no respondía). Se sincronizará en la próxima petición autenticada.`, mark: '  !' });
      }

    } catch (e) {
      error(`Error fatal al gestionar el token del profesor: ${e.message}`);
      if (spinner) {
        spinner.warn({ text: `Advertencia: No se pudo gestionar el token del profesor. Error: ${e.message}`, mark: '  !' });
      } else {
        console.log(`    ${pc.yellow('[TEACHER-TOKEN]')} Advertencia: No se pudo gestionar el token del profesor. Error: ${e.message}`);
      }
    }
  }

  /**
   * @deprecated Usar generate() directamente. Mantenido por compatibilidad hacia atrás.
   */
  static async persistTeacherToken({ user_id, email, token, canvas_sub }) {
    console.warn('[TEACHER-TOKEN] DEPRECADO: persistTeacherToken(). Usar generate() que sincroniza en PostgreSQL automáticamente.');
    try {
      const repo = new CanvasTokenRepository();
      const expiresAt = new Date(Date.now() + LOCAL_TOKEN_EXPIRY_MS);
      const subject = canvas_sub || String(user_id);
      await repo.saveToken(subject, token, null, expiresAt);
      console.log(`${pc.green('[DB]')} Token guardado en canvas_user_tokens (sub: ${subject}).`);
    } catch (dbErr) {
      console.warn(`${pc.yellow('[DB-WARN]')} No se pudo insertar token en base de datos: ${dbErr.message}`);
    }
  }
}
