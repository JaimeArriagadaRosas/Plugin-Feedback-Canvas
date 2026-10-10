import fs from 'node:fs/promises';
import path from 'node:path';
export class SwitchState {
  constructor(root, source, destination) {
    this.file = path.join(root, 'logs', 'switch-state.json');
    this.data = { source, destination, stage: 'started', updatedAt: new Date().toISOString() };
  }
  async stage(value, status = 'running') {
    this.data = { ...this.data, stage: value, status, updatedAt: new Date().toISOString() };
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(this.data, null, 2) + '\n', { mode: 0o600 });
    await fs.rename(tmp, this.file);
  }
}
