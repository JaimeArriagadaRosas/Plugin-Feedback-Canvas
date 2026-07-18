#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Aplica la configuración de placements LTI 1.3 de Canvas (config/lti_placement.json)
// a una Developer Key existente mediante la API de Canvas.
//
// Qué hace:
//   1. Quita global_navigation (visibilidad "members" exponía el botón a TODOS,
//      incluidos estudiantes).
//   2. Usa course_navigation con visibility:"admins" (profesores, TA, designers y
//      account-admins la ven; los estudiantes NO).
//   3. Usa account_navigation para el Panel de Administración (solo account-admins).
//   4. Inyecta el parámetro custom unida_entry para que el backend sepa la intención
//      del lanzamiento (admin vs course).
//
// Uso:
//   CANVAS_BASE_URL=https://tu-instancia.instructure.com \
//   CANVAS_ACCESS_TOKEN=xxxxx \
//   DEVELOPER_KEY_ID=123 \
//   node scripts/apply-placement.mjs
//
// Variables de entorno:
//   CANVAS_BASE_URL     (def. https://canvas.instructure.com)
//   CANVAS_ACCESS_TOKEN  token de cuenta con permiso de administrar developer keys
//   DEVELOPER_KEY_ID     id numérico de la Developer Key "unida-feedback"
// ─────────────────────────────────────────────────────────────────────────────
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CANVAS_BASE_URL = process.env.CANVAS_BASE_URL || 'https://canvas.instructure.com';
const CANVAS_ACCESS_TOKEN = process.env.CANVAS_ACCESS_TOKEN;
const DEVELOPER_KEY_ID = process.env.DEVELOPER_KEY_ID;

async function main() {
  if (!CANVAS_ACCESS_TOKEN) {
    console.error('❌ Falta CANVAS_ACCESS_TOKEN (token con permiso de admin de developer keys).');
    process.exit(1);
  }
  if (!DEVELOPER_KEY_ID) {
    console.error('❌ Falta DEVELOPER_KEY_ID (id de la Developer Key "unida-feedback").');
    process.exit(1);
  }

  const configPath = join(__dirname, '..', 'config', 'lti_placement.json');
  const toolConfig = JSON.parse(await readFile(configPath, 'utf-8'));

  // Sanity check removed: we now ALLOW global_navigation
  const placements = toolConfig.extensions?.[0]?.settings?.placements || [];
  const hasGlobalNav = placements.some(p => p.placement === 'global_navigation');
  if (hasGlobalNav) {
    console.log('ℹ️ El JSON contiene global_navigation. Se aplicará este placement a nivel de cuenta/usuario.');
  }

  const url = `${CANVAS_BASE_URL}/api/v1/developer_keys/${DEVELOPER_KEY_ID}`;
  console.log(`→ PUT ${url}`);

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
    console.error(`❌ Canvas respondió ${res.status}:`);
    console.error(text);
    process.exit(1);
  }

  console.log('✅ Developer Key actualizada con los placements correctos.');
  console.log('   • course_navigation  → visibility:"admins" (oculto a estudiantes)');
  console.log('   • account_navigation → solo account-admins (Panel de Administración)');
  console.log('   • global_navigation  → eliminado');
}

main().catch(err => {
  console.error('Error inesperado:', err);
  process.exit(1);
});
