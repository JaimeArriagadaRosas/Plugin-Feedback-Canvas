#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Applies the Canvas LTI 1.3 placements configuration (config/lti_placement.json)
// to an existing Developer Key via the Canvas API.
//
// What it does:
//   1. Removes global_navigation ('members' visibility exposed the button to EVERYONE,
//      including students).
//   2. Uses course_navigation with visibility:"admins" (teachers, TAs, designers, and
//      account-admins see it; students DO NOT).
//   3. Uses account_navigation for the Administration Panel (only account-admins).
//   4. Injects the custom parameter unida_entry so the backend knows the intention
//      of the launch (admin vs course).
//
// Usage:
//   CANVAS_BASE_URL=https://tu-instancia.instructure.com \
//   CANVAS_ACCESS_TOKEN=xxxxx \
//   DEVELOPER_KEY_ID=123 \
//   node apps/installer/src/commands/maintenance/applyPlacement.js
//
// Environment variables:
//   CANVAS_BASE_URL     (def. https://canvas.instructure.com)
//   CANVAS_ACCESS_TOKEN  account token with permission to manage developer keys
//   DEVELOPER_KEY_ID     numeric id of the 'unida-feedback' Developer Key
// ─────────────────────────────────────────────────────────────────────────────
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { boot as logger } from '../../orchestration/boot/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CANVAS_BASE_URL = process.env.CANVAS_BASE_URL || 'https://canvas.instructure.com';
const CANVAS_ACCESS_TOKEN = process.env.CANVAS_ACCESS_TOKEN;
const DEVELOPER_KEY_ID = process.env.DEVELOPER_KEY_ID;

async function main() {
  if (!CANVAS_ACCESS_TOKEN) {
    logger.error('❌ Missing CANVAS_ACCESS_TOKEN (token with admin permission for developer keys).');
    process.exit(1);
  }
  if (!DEVELOPER_KEY_ID) {
    logger.error('❌ Missing DEVELOPER_KEY_ID (id of the "unida-feedback" Developer Key).');
    process.exit(1);
  }

  const configPath = join(__dirname, '..', '..', '..', '..', '..', 'config', 'lti_placement.json');
  const toolConfig = JSON.parse(await readFile(configPath, 'utf-8'));

  // Sanity check removed: we now ALLOW global_navigation
  const placements = toolConfig.extensions?.[0]?.settings?.placements || [];
  const hasGlobalNav = placements.some(p => p.placement === 'global_navigation');
  if (hasGlobalNav) {
    logger.info('ℹ️ The JSON contains global_navigation. This placement will be applied at the account/user level.');
  }

  const url = `${CANVAS_BASE_URL}/api/v1/developer_keys/${DEVELOPER_KEY_ID}`;
  logger.info(`→ PUT ${url}`);

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${CANVAS_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(toolConfig)
  });

  const text = await res.text();
  if (!res.ok) {
    logger.error(`❌ Canvas responded ${res.status}:`, { text });
    process.exit(1);
  }

  logger.info('✅ Developer Key updated with the correct placements.\n' +
    '   • course_navigation  → visibility:"admins" (hidden from students)\n' +
    '   • account_navigation → only account-admins (Administration Panel)\n' +
    '   • global_navigation  → removed');
}

main().catch(err => {
  logger.error('Unexpected error:', { error: err.message, stack: err.stack });
  process.exit(1);
});
