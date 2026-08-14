#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Removes the Canvas Theme script (unida_nav_fix.js) which hid the 'Unida' button
// manipulating the DOM. No longer needed: visibility is controlled by Canvas
// via placements and the backend blocks students on launch.
//
// The Theme JavaScript is saved in the account 'brand config'. This script
// empties it (brand_config[js]="") for the indicated account.
//
// Usage:
//   CANVAS_BASE_URL=https://tu-instancia.instructure.com \
//   CANVAS_ACCESS_TOKEN=xxxxx \
//   CANVAS_ACCOUNT_ID=1 \
//   node apps/installer/src/commands/maintenance/removeThemeFix.js
//
// Environment variables:
//   CANVAS_BASE_URL     (def. https://canvas.instructure.com)
//   CANVAS_ACCESS_TOKEN  admin account token
//   CANVAS_ACCOUNT_ID    account id (def. 1 = root account)
//   DRY_RUN              if="true", only reports, does not modify
// ─────────────────────────────────────────────────────────────────────────────
import { boot as logger } from '../../orchestration/boot/logger.js';

const CANVAS_BASE_URL = process.env.CANVAS_BASE_URL || 'https://canvas.instructure.com';
const CANVAS_ACCESS_TOKEN = process.env.CANVAS_ACCESS_TOKEN;
const ACCOUNT_ID = process.env.CANVAS_ACCOUNT_ID || '1';
const DRY_RUN = process.env.DRY_RUN === 'true';

async function getCurrentJs() {
  const url = `${CANVAS_BASE_URL}/api/v1/accounts/${ACCOUNT_ID}/brand_config`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${CANVAS_ACCESS_TOKEN}` }
  });
  if (!res.ok) {
    if (res.status === 404) return '';
    const text = await res.text();
    throw new Error(`GET brand_config failed ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.js || '';
}

async function clearThemeJs() {
  const url = `${CANVAS_BASE_URL}/api/v1/accounts/${ACCOUNT_ID}/brand_config`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${CANVAS_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ brand_config: { js: '' } })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PUT brand_config failed ${res.status}: ${text}`);
  }
  return true;
}

async function main() {
  if (!CANVAS_ACCESS_TOKEN) {
    logger.error('❌ Missing CANVAS_ACCESS_TOKEN (admin account token).');
    process.exit(1);
  }

  const currentJs = await getCurrentJs();
  const snippet = 'unida_nav_fix';
  const containsFix = currentJs.includes(snippet);

  if (!containsFix) {
    logger.info(`✅ "${snippet}" not found in the Theme JS of account ${ACCOUNT_ID}. Nothing to do.`);
    return;
  }

  logger.warn(`⚠️  "${snippet}" detected in the Theme of account ${ACCOUNT_ID}.`);
  if (DRY_RUN) {
    logger.info('🔍 DRY_RUN=true: nothing was modified. Run without DRY_RUN to clear the Theme.');
    return;
  }

  await clearThemeJs();
  logger.info('✅ Theme JS cleared. The unida_nav_fix.js script is no longer injected.\n' + 
              '   Button visibility is now controlled by Canvas via placements.');
}

main().catch(err => {
  logger.error('Unexpected error:', { error: err.message });
  process.exit(1);
});
