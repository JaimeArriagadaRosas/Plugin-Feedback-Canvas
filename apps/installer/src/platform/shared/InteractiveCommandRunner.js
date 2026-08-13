import { spawn } from 'node:child_process';

export function runInteractiveCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      shell: false,
      stdio: 'inherit'
    });
    child.once('error', () => resolve(false));
    child.once('close', (code) => resolve(code === 0));
  });
}
