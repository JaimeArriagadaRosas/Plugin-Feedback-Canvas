/**
 * System token regeneration script for local Docker environment.
 * Usage: node apps/installer/src/commands/maintenance/regenerateSystemToken.js
 */
import 'dotenv/config';
import { SystemTokenManager } from '../../local/SystemTokenManager.js';

console.log('[REGEN] Starting system token regeneration...');
console.log('[REGEN] Current token:', process.env.CANVAS_ACCESS_TOKEN?.slice(0, 10) + '...');

try {
  await SystemTokenManager.generate(null);
  console.log('[REGEN] New token:', process.env.CANVAS_ACCESS_TOKEN?.slice(0, 10) + '...');
  console.log('[REGEN] ✅ Token regenerated successfully.');
} catch (e) {
  console.error('[REGEN] ❌ Error regenerating token:', e.message);
  process.exit(1);
}
