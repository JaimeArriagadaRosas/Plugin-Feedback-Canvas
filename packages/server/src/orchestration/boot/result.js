/**
 * BootResult — Tipo de resultado uniforme para cada verificación/etapa.
 *
 * Centraliza el modelo de "éxito / advertencia / fallo" y la capacidad de
 * auto-corrección y degradación, de modo que el orquestador (main.js) pueda
 * tomar decisiones de forma declarativa en lugar de mirar banderas dispersas.
 */
export class BootResult {
  constructor({ ok, critical = false, message = '', fix = '', autoFixed = false, data = {}, degraded = false }) {
    this.ok = ok;            // ¿la etapa pasó o se corrigió?
    this.critical = critical; // ¿detiene el arranque si falla?
    this.degraded = degraded; // pasó pero con funcionalidad reducida (no bloquea)
    this.message = message;   // mensaje legible del resultado
    this.fix = fix;           // instrucción para el usuario si falla
    this.autoFixed = autoFixed; // el orquestador corrigió automáticamente
    this.data = data;         // datos derivados (rutas, versiones, ids, etc.)
  }

  static ok(data = {}, message = '')  { return new BootResult({ ok: true, data, message }); }
  static warn(message, fix = '')      { return new BootResult({ ok: true, degraded: true, message, fix }); }
  static fixed(message, data = {})    { return new BootResult({ ok: true, autoFixed: true, message, data }); }
  static fail(critical, message, fix = '', data = {}) {
    return new BootResult({ ok: false, critical, message, fix, data });
  }
}
