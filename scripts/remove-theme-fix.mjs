#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Elimina el script de Theme de Canvas (unida_nav_fix.js) que ocultaba el botón
// "Unida" manipulando el DOM. Ya no es necesario: la visibilidad la controla
// Canvas vía placements y el backend bloquea estudiantes en el lanzamiento.
//
// El JavaScript de Theme se guarda en la "brand config" de la cuenta. Este script
// lo vacía (brand_config[js]="") para la cuenta indicada.
//
// Uso:
//   CANVAS_BASE_URL=https://tu-instancia.instructure.com \
//   CANVAS_ACCESS_TOKEN=xxxxx \
//   CANVAS_ACCOUNT_ID=1 \
//   node scripts/remove-theme-fix.mjs
//
// Variables de entorno:
//   CANVAS_BASE_URL     (def. https://canvas.instructure.com)
//   CANVAS_ACCESS_TOKEN  token de cuenta admin
//   CANVAS_ACCOUNT_ID    id de cuenta (def. 1 = root account)
//   DRY_RUN              si="true", solo reporta, no modifica
// ─────────────────────────────────────────────────────────────────────────────
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
    throw new Error(`GET brand_config falló ${res.status}: ${text}`);
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
    throw new Error(`PUT brand_config falló ${res.status}: ${text}`);
  }
  return true;
}

async function main() {
  if (!CANVAS_ACCESS_TOKEN) {
    console.error('❌ Falta CANVAS_ACCESS_TOKEN (token admin de cuenta).');
    process.exit(1);
  }

  const currentJs = await getCurrentJs();
  const snippet = 'unida_nav_fix';
  const contieneFix = currentJs.includes(snippet);

  if (!contieneFix) {
    console.log(`✅ No se encontró "${snippet}" en el JS del Theme de la cuenta ${ACCOUNT_ID}. Nada que hacer.`);
    return;
  }

  console.warn(`⚠️  Se detectó "${snippet}" en el Theme de la cuenta ${ACCOUNT_ID}.`);
  if (DRY_RUN) {
    console.log('🔍 DRY_RUN=true: no se modificó nada. Ejecuta sin DRY_RUN para limpiar el Theme.');
    return;
  }

  await clearThemeJs();
  console.log('✅ JS del Theme vaciado. El script unida_nav_fix.js ya no se inyecta.');
  console.log('   La visibilidad del botón ahora la controla Canvas vía placements.');
}

main().catch(err => {
  console.error('Error inesperado:', err.message);
  process.exit(1);
});
