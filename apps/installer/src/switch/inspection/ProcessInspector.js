import fs from 'node:fs';
import path from 'node:path';
const ALLOWED = /(?:^|\/|\\)(?:node(?:\.exe)?|npm(?:\.cmd)?|vite|tsx|nodemon)(?:\0|\s|$)/i;
function proc(pid) {
  try {
    const cwd = fs.realpathSync(`/proc/${pid}/cwd`);
    const command = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8');
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    const rest = stat.slice(stat.lastIndexOf(')') + 2).split(/\s+/);
    return { pid, cwd, command, parentPid: Number(rest[1]), startTime: rest[19] };
  } catch { return null; }
}
function ancestors() {
  const known = new Set();
  let pid = process.pid;
  while (pid > 1 && !known.has(pid)) {
    known.add(pid);
    pid = proc(pid)?.parentPid || 0;
  }
  return known;
}
export function inspectProcesses(root) {
  if (process.platform !== 'linux' || !fs.existsSync('/proc')) return { supported: false, processes: [] };
  const rootReal = fs.realpathSync(root);
  const ignored = ancestors();
  const processes = [];
  for (const entry of fs.readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) continue;
    const pid = Number(entry);
    if (ignored.has(pid)) continue;
    const p = proc(pid);
    if (!p || p.cwd !== rootReal || !ALLOWED.test(p.command)) continue;
    processes.push({ pid, startTime: p.startTime, command: p.command.split('\0')[0] });
  }
  return { supported: true, processes };
}
export function stillOwned(pid, startTime, root) {
  const p = proc(pid);
  return Boolean(p && p.startTime === startTime && p.cwd === fs.realpathSync(root) && ALLOWED.test(p.command));
}
