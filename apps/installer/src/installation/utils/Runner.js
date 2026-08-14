import { execa } from 'execa';
import fs from 'node:fs';

const TAIL_LINES = 50;

/** Retains only the last lines of a process with massive output. */
export class TailBuffer {
  constructor(maxLines = TAIL_LINES) {
    this._lines = [];
    this._maxLines = maxLines;
    this._remainder = '';
  }

  push(chunk) {
    const parts = (this._remainder + chunk).split('\n');
    this._remainder = parts.pop() || '';
    if (parts.length === 0) return;
    this._lines = this._lines.concat(parts).slice(-this._maxLines);
  }

  toString() {
    const lines = this._remainder ? [...this._lines, this._remainder] : this._lines;
    return lines.slice(-this._maxLines).join('\n');
  }
}

/**
 * Executes a subprocess without shell and limits the output retained in memory.
 * `logMode: 'on-failure'` prevents writing full logs of successful
 * installations; retains only the useful summary if the process fails.
 */
export async function runCommand(command, args = [], options = {}) {
  const {
    cwd, timeout, logFile, logMode = 'full', onData, env, input,
    captureAll = false, interactive = false
  } = options;
  let outAccum = captureAll ? '' : new TailBuffer();
  let errAccum = captureAll ? '' : new TailBuffer();
  const shouldWriteFullLog = logFile && logMode !== 'on-failure';

  try {
    if (shouldWriteFullLog) appendLog(logFile, `\n--- Executing: ${command} ${args.join(' ')} ---\n`);
    const child = execa(command, args, {
      cwd,
      env: { ...process.env, ...env },
      timeout,
      input,
      stdin: interactive ? 'inherit' : undefined,
      buffer: captureAll
    });

    const handleData = (data, isStderr) => {
      const text = data.toString();
      if (isStderr) {
        if (captureAll) errAccum += text;
        else errAccum.push(text);
      } else if (captureAll) outAccum += text;
      else outAccum.push(text);
      if (onData) onData(text, isStderr);
      if (shouldWriteFullLog) appendLog(logFile, text);
    };
    child.stdout?.on('data', (data) => handleData(data, false));
    child.stderr?.on('data', (data) => handleData(data, true));

    const result = await child;
    return {
      success: result.exitCode === 0,
      out: captureAll ? (result.stdout || outAccum) : outAccum.toString(),
      err: captureAll ? (result.stderr || errAccum) : errAccum.toString(),
      code: result.exitCode
    };
  } catch (error) {
    if (captureAll) {
      if (error.stdout) outAccum += error.stdout;
      if (error.stderr) errAccum += error.stderr;
    } else {
      if (error.stdout) outAccum.push(error.stdout);
      if (error.stderr) errAccum.push(error.stderr);
    }
    const out = captureAll ? outAccum : outAccum.toString();
    const err = captureAll ? errAccum : errAccum.toString() ||
      `[EXECA ERROR] ${error?.message || String(error)}`;
    if (logFile && logMode === 'on-failure') appendFailureSummary(logFile, command, args, out, err);
    return { success: false, out, err, code: error?.exitCode || -1 };
  }
}

function appendFailureSummary(logFile, command, args, out, err) {
  appendLog(logFile, [
    `\n--- Failed: ${command} ${args.join(' ')} ---`, out, err,
    '--- End of failure summary ---\n'
  ].filter(Boolean).join('\n'));
}

function appendLog(logFile, content) {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.appendFileSync(logFile, content);
  } catch {
    // Do not hide the command result if the log cannot be written.
  }
}
