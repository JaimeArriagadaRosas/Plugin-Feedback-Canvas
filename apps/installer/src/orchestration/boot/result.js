/**
 * BootResult — Uniform result type for each verification/stage.
 *
 * Centralizes the 'success / warning / failure' model and the ability
 * to auto-correct and degrade, so that the orchestrator (main.js) can
 * make declarative decisions instead of looking at scattered flags.
 */
export class BootResult {
  constructor({ ok, critical = false, message = '', fix = '', autoFixed = false, data = {}, degraded = false }) {
    this.ok = ok;            // did the stage pass or was it fixed?
    this.critical = critical; // does it stop the boot if it fails?
    this.degraded = degraded; // passed but with reduced functionality (does not block)
    this.message = message;   // readable result message
    this.fix = fix;           // instruction for the user if it fails
    this.autoFixed = autoFixed; // the orchestrator fixed it automatically
    this.data = data;         // derived data (paths, versions, ids, etc.)
  }

  static ok(data = {}, message = '')  { return new BootResult({ ok: true, data, message }); }
  static warn(message, fix = '')      { return new BootResult({ ok: true, degraded: true, message, fix }); }
  static fixed(message, data = {})    { return new BootResult({ ok: true, autoFixed: true, message, data }); }
  static fail(critical, message, fix = '', data = {}) {
    return new BootResult({ ok: false, critical, message, fix, data });
  }
}
