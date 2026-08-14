import pc from 'picocolors';

/**
 * BootLogger — Hierarchical and consistent output system for booting.
 *
 * Responsibilities (SRP):
 *  - Emit messages with semantic level (info, progress, success, warn,
 *    error, auto = automatic action, action = user required action).
 *  - Group the output by 'stage' visually and collapsibly.
 *  - Avoid spam through a deduplication cache of identical lines.
 *
 * Does not make business decisions: only presents. The verification logic
 * lives in the check/* modules.
 */

const LEVELS = {
  info:     { tag: pc.cyan('·'),  plain: 'INFO ' },
  progress: { tag: pc.blue('…'),  plain: '.... ' },
  success:  { tag: pc.green('√'),  plain: 'OK   ' },
  warn:     { tag: pc.yellow('!'),  plain: 'WARN ' },
  error:    { tag: pc.red('!'),  plain: 'ERROR' }, // Error unified to red exclamation
  auto:     { tag: pc.cyan('·'), plain: 'AUTO ' },
  action:   { tag: pc.cyan('·') + pc.yellow(' Guide:'), plain: 'ACTION' },
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

  plain(msg) {
    if (!this._visible('info')) return;
    const indent = '  '.repeat(this.stageStack.length);
    process.stdout.write(`${indent}${msg}\n`);
  }

  log(level, msg, opts = {}) {
    // eslint-disable-next-line security/detect-object-injection
    const meta = LEVELS[level] || LEVELS.info;
    if (!this._visible(level)) return;

    if (opts.dedupe) {
      const key = this._dedupeKey(msg);
      if (this._dedupe.has(key)) return;
      this._dedupe.add(key);
    }

    const indent = '  '.repeat(this.stageStack.length);
    process.stdout.write(`${indent}${meta.tag} ${msg}\n`);
  }

  info(msg, opts)     { this.log('info', msg, opts); }
  progress(msg, opts) { this.log('progress', msg, opts); }
  success(msg, opts)  { this.log('success', msg, opts); }
  warn(msg, opts)     { this.log('warn', msg, opts); }
  error(msg, opts)    { this.log('error', msg, opts); }
  debug(msg, opts)    { if (this.verbosity === 'debug') this.log('info', pc.gray(msg), opts); }

  /** Action performed automatically by the orchestrator to fix. */
  auto(msg, opts) { this.log('auto', msg, opts); }

  /** Action that the user must perform manually. */
  action(msg, opts) { this.log('action', msg, opts); }

  /** Starts a visual stage (header line + indentation level). */
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

  /** Executes fn within a stage and always closes it (success or error). */
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
