import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execute = promisify(execFile);
export async function run(command, args, options = {}) {
  const { cwd, timeout = 30000, env = process.env } = options;
  try {
    const { stdout, stderr } = await execute(command, args, { cwd, timeout, env, maxBuffer: 4 * 1024 * 1024, windowsHide: true });
    return { ok: true, stdout: String(stdout).trim(), stderr: String(stderr).trim(), code: 0 };
  } catch (e) {
    return { ok: false, stdout: String(e.stdout || '').trim(), stderr: String(e.stderr || e.message).trim(), code: e.code };
  }
}
export function requireSuccess(result, label) {
  if (!result.ok) throw new Error(`${label}: ${result.stderr || result.stdout || result.code}`);
  return result;
}
