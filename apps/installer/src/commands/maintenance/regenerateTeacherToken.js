/**
 * Teacher token regeneration script for local Docker environment.
 * Usage: node apps/installer/src/commands/maintenance/regenerateTeacherToken.js
 */
import 'dotenv/config';
import { TeacherTokenGenerator } from '../../local/TeacherTokenGenerator.js';

console.log('[REGEN] Starting teacher token regeneration...');
console.log('[REGEN] Current token:', process.env.CANVAS_ACCESS_TOKEN?.slice(0, 10) + '...');

try {
  await TeacherTokenGenerator.generate(null);
  console.log('[REGEN] New token:', process.env.CANVAS_ACCESS_TOKEN?.slice(0, 10) + '...');
  console.log('[REGEN] ✅ Token regenerated successfully.');
} catch (e) {
  console.error('[REGEN] ❌ Error regenerating token:', e.message);
  process.exit(1);
}
