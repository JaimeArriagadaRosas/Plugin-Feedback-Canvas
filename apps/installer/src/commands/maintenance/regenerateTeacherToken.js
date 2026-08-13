/**
 * Script de regeneración del token del profesor para entorno Docker local.
 * Uso: node apps/installer/src/commands/maintenance/regenerateTeacherToken.js
 */
import 'dotenv/config';
import { TeacherTokenGenerator } from '../../local/TeacherTokenGenerator.js';

console.log('[REGEN] Iniciando regeneración del token del profesor...');
console.log('[REGEN] Token actual:', process.env.CANVAS_ACCESS_TOKEN?.slice(0, 10) + '...');

try {
  await TeacherTokenGenerator.generate(null);
  console.log('[REGEN] Token nuevo:', process.env.CANVAS_ACCESS_TOKEN?.slice(0, 10) + '...');
  console.log('[REGEN] ✅ Token regenerado con éxito.');
} catch (e) {
  console.error('[REGEN] ❌ Error al regenerar token:', e.message);
  process.exit(1);
}
