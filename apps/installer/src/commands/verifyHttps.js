#!/usr/bin/env node
/**
 * verify-https.mjs — HTTPS VERIFICATION AND VALIDATION Stage
 * Refactored from the old scripts/ directory to apps/installer/
 */

import path from 'node:path';
import { PLUGIN_DIR, collectFiles, SCAN_ROOTS } from '../diagnostics/fileSystem.js';
import { C, state, log, step, ok, warn, fail, info } from '../diagnostics/logger.js';
import {
  validateCerts, validateEnv, validateLtiPlacement, scanHttpReferences,
  validateSecurityHeaders, validateCodeDefaults, validateConnectivity,
  validateDocker, validateHosts, applyFixes, isExpectedInternalHttp, LOCAL_HTTP_RE
} from '../diagnostics/validators.js';

const args = process.argv.slice(2);
state.fix = args.includes('--fix');
state.silent = args.includes('--silent');

async function main() {
  log(`\n${C.bold}${C.magenta}══════════════════════════════════════════════════════════════${C.reset}`);
  log(`${C.bold}${C.magenta}  HTTPS VERIFICATION AND VALIDATION — Adaptive Feedback Plugin${C.reset}`);
  log(`${C.bold}${C.magenta}  ${new Date().toLocaleString('es-CL')}${C.reset}`);
  log(`${C.bold}${C.magenta}══════════════════════════════════════════════════════════════${C.reset}`);

  step('Starting HTTPS configuration verification...');
  info('Collecting project files (excludes node_modules/dist/.git/canvas-lms-master)');
  const files = [];
  for (const root of SCAN_ROOTS) collectFiles(root, files);
  info(`Files to inspect: ${files.length}`);

  step('Analyzing existing configuration...');
  await validateCerts();
  validateEnv();
  validateLtiPlacement();
  validateHosts();
  validateDocker();

  step('Detecting legacy HTTP references...');
  const httpHits = scanHttpReferences(files);
  if (httpHits.length === 0) {
    ok('No explicit HTTP references outside IMS vocabularies', '');
  } else {
    const local = httpHits.filter(h => LOCAL_HTTP_RE.test(h.url));
    const relevant = local.filter(h => !isExpectedInternalHttp(h));
    for (const h of relevant) {
      const rel = path.relative(PLUGIN_DIR, h.file);
      fail(`Legacy HTTP: ${h.url}`, `${rel}:${h.line}`, 'Must be migrated to HTTPS for LTI consistency.', 'MEDIUM/HIGH');
    }
    const expectedCount = local.length - relevant.length;
    if (expectedCount > 0) info(`${expectedCount} internal HTTP URLs allowed`, 'Gotenberg, internal Canvas or local allowlist');
    const otherCount = httpHits.length - local.length;
    if (otherCount > 0) info(`Other ${otherCount} external http URLs`, 'review manually');
  }

  step('Validating certificates and SSL/TLS configuration...');
  validateSecurityHeaders(files);
  validateCodeDefaults(files);

  step('Running HTTPS connectivity tests...');
  await validateConnectivity();

  step('Verifying local environment compatibility (Docker)...');

  step('Finishing HTTPS validations...');
  applyFixes();

  log(`\n${C.bold}══════════════════════════════════════════════════════════════${C.reset}`);
  log(`${C.bold}  HTTPS VERIFICATION SUMMARY:${C.reset}`);
  log(`  ${C.green}✅ Passed:${C.reset} ${state.passed}`);
  log(`  ${C.yellow}⚠️  Warnings:${C.reset}   ${state.warnings}`);
  log(`  ${C.red}❌ Findings:${C.reset} ${state.failures}`);
  log(`${C.bold}══════════════════════════════════════════════════════════════${C.reset}`);

  if (state.failures === 0) {
    log(`\n${C.green}${C.bold}🎉 Consistent and verified HTTPS. No relevant HTTP configurations remain.${C.reset}\n`);
  } else {
    log(`\n${C.red}${C.bold}🚨 Found ${state.failures} legacy HTTP configuration(s) that require attention.${C.reset}`);
    log(`${C.gray}   Run: npm run verify:https to fix low-risk ones.${C.reset}\n`);
  }

  process.exit(state.failures > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Error executing HTTPS verification:', e.message);
  process.exit(2);
});
