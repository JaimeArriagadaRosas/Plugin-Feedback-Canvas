import pc from 'picocolors';

/**
 * BootLogger — Sistema de salida jerárquico y consistente para el arranque.
 *
 * Responsabilidades (SRP):
 *  - Emitir mensajes con nivel semántico (info, progress, success, warn,
 *    error, auto = acción automática, action = acción requerida por el usuario).
 *  - Agrupar la salida por "etapa" (stage) de forma visual y colapsable.
 *  - Evitar spam mediante un caché de deduplicación de líneas idénticas.
 *
 * No toma decisiones de negocio: solo presenta. La lógica de verificación
 * vive en los módulos check/*.
 */

const LEVELS = {
  info:     { tag: pc.cyan('ℹ'),  plain: 'INFO ' },
  progress: { tag: pc.blue('…'),  plain: '.... ' },
  success:  { tag: pc.green('✔'),  plain: 'OK   ' },
  warn:     { tag: pc.yellow('⚠'),  plain: 'WARN ' },
  error:    { tag: pc.red('✖'),  plain: 'ERROR' },
  auto:     { tag: pc.magenta('⚙'), plain: 'AUTO ' },
  action:   { tag: pc.bold(pc.yellow('▶')), plain: 'ACTION' },
};

const STAGE_COLORS = [
  pc.cyan, pc.magenta, pc.blue, pc.green, pc.yellow, pc.gray,
];

export class BootLogger {
  constructor(options = {}) {
    this.verbosity = options.verbosity ?? 'normal'; // 'quiet' | 'normal' | 'debug'
    this.stageStack = [];
    this.stageIndex = 0;
    this._dedupe = new Set();
    this._autoCleanup = null;
  }

  setVerbosity(v) {
    if (['quiet', 'normal', 'debug'].includes(v)) this.verbosity = v;
  }

  _visible(level) {
    if (this.verbosity === 'quiet' && (level === 'info' || level === 'progress' || level === 'debug')) return false;
    return true;
  }

  _dedupeKey(msg) {
    return msg;
  }

  log(level, msg, opts = {}) {
    const meta = LEVELS[level] || LEVELS.info;
    if (!this._visible(level)) return;

    if (opts.dedupe) {
      const key = this._dedupeKey(msg);
      if (this._dedupe.has(key)) return;
      this._dedupe.add(key);
    }

    const indent = '  '.repeat(this.stageStack.length);
    const stageTag = this.stageStack.length
      ? pc.gray(`[${this.stageStack[this.stageStack.length - 1]}] `)
      : '';
    process.stdout.write(`${indent}${meta.tag} ${stageTag}${msg}\n`);
  }

  info(msg, opts)     { this.log('info', msg, opts); }
  progress(msg, opts) { this.log('progress', msg, opts); }
  success(msg, opts)  { this.log('success', msg, opts); }
  warn(msg, opts)     { this.log('warn', msg, opts); }
  error(msg, opts)    { this.log('error', msg, opts); }
  debug(msg, opts)    { if (this.verbosity === 'debug') this.log('info', pc.gray(msg), opts); }

  /** Acción realizada automáticamente por el orquestador para corregir. */
  auto(msg, opts) { this.log('auto', msg, opts); }

  /** Acción que el usuario debe realizar manualmente. */
  action(msg, opts) { this.log('action', msg, opts); }

  /** Inicia una etapa visual (línea de cabecera + nivel de indentación). */
  stage(name) {
    this.stageStack.push(name);
    const color = STAGE_COLORS[this.stageIndex % STAGE_COLORS.length];
    this.stageIndex++;
    const indent = '  '.repeat(this.stageStack.length - 1);
    process.stdout.write(`\n${indent}${pc.bold(color('── ▶ ' + name + ' '))}${'─'.repeat(Math.max(2, 48 - name.length))}\n`);
    return name;
  }

  endStage() {
    this.stageStack.pop();
  }

  /** Ejecuta fn dentro de una etapa y la cierra siempre (éxito o error). */
  async withStage(name, fn) {
    this.stage(name);
    try {
      return await fn();
    } finally {
      this.endStage();
    }
  }
}

export const boot = new BootLogger();
export default boot;
