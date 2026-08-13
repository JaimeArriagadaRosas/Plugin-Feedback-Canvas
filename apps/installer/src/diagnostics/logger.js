export const C = {
  reset: '\x1b[0m', bold: '\x1b[1m',
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', gray: '\x1b[90m', magenta: '\x1b[35m', blue: '\x1b[34m',
};

export const state = { passed: 0, warnings: 0, failures: 0, findings: [], silent: false, fix: false };

export function log(msg) { if (!state.silent) console.log(msg); }
export function step(label) { log(`\n${C.cyan}${C.bold}▶ ${label}${C.reset}`); }
export function ok(label, detail = '') { state.passed++; log(`  ${C.green}✅${C.reset} ${label}${detail ? C.gray + ' — ' + detail + C.reset : ''}`); }
export function warn(label, detail = '') { state.warnings++; log(`  ${C.yellow}⚠️ ${C.reset} ${label}${detail ? C.gray + ' — ' + detail + C.reset : ''}`); }
export function fail(label, detail = '', impact = '', risk = '') {
  state.failures++;
  log(`  ${C.red}❌${C.reset} ${C.bold}${label}${C.reset}` + (detail ? C.gray + ' — ' + detail + C.reset : ''));
  if (impact) log(`     ${C.yellow}→ Impacto: ${impact}${C.reset}`);
  if (risk) log(`     ${C.red}→ Riesgo: ${risk}${C.reset}`);
  state.findings.push({ label, detail, impact, risk });
}
export function info(label, detail = '') { log(`  ${C.blue}ℹ${C.reset} ${label}${detail ? C.gray + ' — ' + detail + C.reset : ''}`); }
