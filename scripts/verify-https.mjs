#!/usr/bin/env node
/**
 * verify-https.mjs — Etapa de VERIFICACIÓN Y VALIDACIÓN HTTPS
 * Refactorizado en submódulos dentro de scripts/utils/
 */

import path from 'node:path';
import { PLUGIN_DIR, collectFiles, SCAN_ROOTS } from './utils/fileSystem.mjs';
import { C, state, log, step, ok, warn, fail, info } from './utils/logger.mjs';
import { 
  validateCerts, validateEnv, validateLtiPlacement, scanHttpReferences, 
  validateSecurityHeaders, validateCodeDefaults, validateConnectivity, 
  validateDocker, applyFixes, LOCAL_HTTP_RE 
} from './utils/validators.mjs';

const args = process.argv.slice(2);
state.fix = args.includes('--fix');
state.silent = args.includes('--silent');

async function main() {
  log(`\n${C.bold}${C.magenta}══════════════════════════════════════════════════════════════${C.reset}`);
  log(`${C.bold}${C.magenta}  VERIFICACIÓN Y VALIDACIÓN HTTPS — Plugin Feedback Adaptativo${C.reset}`);
  log(`${C.bold}${C.magenta}  ${new Date().toLocaleString('es-CL')}${C.reset}`);
  log(`${C.bold}${C.magenta}══════════════════════════════════════════════════════════════${C.reset}`);

  step('Iniciando verificación de configuración HTTPS...');
  info('Recopilando archivos del proyecto (excluye node_modules/dist/.git/canvas-lms-master)');
  const files = [];
  for (const root of SCAN_ROOTS) collectFiles(root, files);
  info(`Archivos a inspeccionar: ${files.length}`);

  step('Analizando configuración existente...');
  await validateCerts();
  validateEnv();
  validateLtiPlacement();
  validateDocker();

  step('Detectando referencias HTTP heredadas...');
  const httpHits = scanHttpReferences(files);
  if (httpHits.length === 0) {
    ok('Sin referencias HTTP explícitas fuera de vocabularios IMS', '');
  } else {
    const relevant = httpHits.filter(h => LOCAL_HTTP_RE.test(h.url));
    for (const h of relevant) {
      const rel = path.relative(PLUGIN_DIR, h.file);
      fail(`HTTP heredado: ${h.url}`, `${rel}:${h.line}`, 'Debe migrarse a HTTPS para coherencia LTI.', 'MEDIO/ALTO');
    }
    const otherCount = httpHits.length - relevant.length;
    if (otherCount > 0) info(`Otras ${otherCount} URL http detectadas (externas/comentarios)`, 'revisar manualmente');
  }

  step('Validando certificados y configuración SSL/TLS...');
  validateSecurityHeaders(files);
  validateCodeDefaults(files);

  step('Ejecutando pruebas de conectividad HTTPS...');
  await validateConnectivity();

  step('Verificando compatibilidad del entorno local (Docker)...');

  step('Finalizando validaciones HTTPS...');
  applyFixes();

  log(`\n${C.bold}══════════════════════════════════════════════════════════════${C.reset}`);
  log(`${C.bold}  RESUMEN DE VERIFICACIÓN HTTPS:${C.reset}`);
  log(`  ${C.green}✅ Correcto:${C.reset} ${state.passed}`);
  log(`  ${C.yellow}⚠️  Avisos:${C.reset}   ${state.warnings}`);
  log(`  ${C.red}❌ Hallazgos:${C.reset} ${state.failures}`);
  log(`${C.bold}══════════════════════════════════════════════════════════════${C.reset}`);

  if (state.failures === 0) {
    log(`\n${C.green}${C.bold}🎉 HTTPS consistente y verificado. No quedan configuraciones HTTP relevantes.${C.reset}\n`);
  } else {
    log(`\n${C.red}${C.bold}🚨 Se encontraron ${state.failures} configuración(es) HTTP heredada(s) que requieren atención.${C.reset}`);
    log(`${C.gray}   Ejecuta: node scripts/verify-https.mjs --fix para corregir las de bajo riesgo.${C.reset}\n`);
  }

  process.exit(state.failures > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Error ejecutando verificación HTTPS:', e.message);
  process.exit(2);
});
