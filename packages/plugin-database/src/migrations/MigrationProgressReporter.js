const CLEAR_LINE = '\u001B[2K\r';

function formatMigrationName(file) {
  return file.replace(/\.sql$/u, '');
}

export class MigrationProgressReporter {
  constructor({ output = process.stdout, interactive = output.isTTY !== false } = {}) {
    this.output = output;
    this.interactive = interactive;
    this.total = 0;
    this.hasActiveLine = false;
  }

  start(total) {
    this.total = total;
    this._writeLine(`  · Applying ${total} local migrations...`);
  }

  migrationStart(index, file) {
    const text = `  · Migration ${index}/${this.total}: ${formatMigrationName(file)}`;
    if (!this.interactive) {
      this._writeLine(text);
      return;
    }
    this.output.write(`${CLEAR_LINE}${text}`);
    this.hasActiveLine = true;
  }

  migrationFailed(index, file) {
    const text = `  × Failed migration ${index}/${this.total}: ${formatMigrationName(file)}`;
    this._finishActiveLine(text);
  }

  complete() {
    this._finishActiveLine(`  √ Local migrations applied (${this.total}/${this.total}).`);
  }

  noPending() {
    this._writeLine('  √ Local migrations up to date.');
  }

  _finishActiveLine(text) {
    if (this.hasActiveLine) this.output.write(`${CLEAR_LINE}${text}\n`);
    else this._writeLine(text);
    this.hasActiveLine = false;
  }

  _writeLine(text) {
    this.output.write(`${text}\n`);
  }
}
