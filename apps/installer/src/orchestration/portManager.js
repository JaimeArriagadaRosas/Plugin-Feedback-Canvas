import * as net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export function isPortInUse(port) {
  return new Promise(resolve => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => server.close(() => resolve(false)));
    server.listen(port);
  });
}

function inspectLinux(port) {
  if (process.platform !== 'linux') return [];
  try {
    const out = execFileSync('ss', ['-ltnpH', 'sport', '=', ':' + Number(port)], {encoding:'utf8',timeout:2500});
    const found = [...out.matchAll(/pid=(\d+)/g)];
    return [...new Set(found.map(m => Number(m[1])))].map(pid => {
      let command = '', cwd = '';
      try { command = fs.readFileSync('/proc/' + pid + '/cmdline', 'utf8').replace(/\0/g, ' ').trim(); } catch {}
      try { cwd = fs.realpathSync('/proc/' + pid + '/cwd'); } catch {}
      return {pid,command,cwd};
    });
  } catch { return []; }
}

export async function inspectPorts(ports) {
  const occupied = [];
  for (const port of ports) if (await isPortInUse(port)) {
    occupied.push({port,owners:inspectLinux(port)});
  }
  return occupied;
}

export async function assertPortsAvailable(...ports) {
  const occupied = await inspectPorts(ports);
  if (occupied.length) {
    throw new Error('Occupied ports: ' + occupied.map(p => p.port).join(', ') +
      '. Processes will not be terminated without approval.');
  }
  return true;
}

export async function resolveStartupPorts(ports, {projectDir, mode, ask} = {}) {
  const conflicts = await inspectPorts(ports);
  if (!conflicts.length) return {reuse:false};
  const project = fs.realpathSync(projectDir);
  const shared = conflicts.flatMap(x => x.owners);
  const unique = [...new Map(shared.map(o => [o.pid,o])).values()];
  const preboots = unique.filter(o =>
    o.cwd && path.resolve(o.cwd) === project &&
    /apps\/installer\/src\/preboot\.js/.test(o.command) &&
    o.pid !== process.pid);
  if (mode === '3' && preboots.length && conflicts.length === ports.length &&
      conflicts.every(x => x.owners.length > 0 && x.owners.every(o => o.cwd && path.resolve(o.cwd) === project)) &&
      conflicts.some(x => x.port === 8443) && conflicts.some(x => x.port === 3000) && conflicts.some(x => x.port === 5173)) {
    return {reuse:true,pid:preboots[0].pid};
  }
  for (const conflict of conflicts) {
    const owners = conflict.owners.length ? conflict.owners : [{pid:null,command:'unknown owner',cwd:''}];
    for (const owner of owners) {
      const belongs = owner.cwd && path.resolve(owner.cwd) === project;
      const description = owner.pid ? 'PID '+owner.pid+' ('+owner.command.slice(0,120)+')' : owner.command;
      if (!owner.pid || !owner.command || !process.stdin.isTTY || typeof ask !== 'function') {
        throw new Error('Port '+conflict.port+' occupied by '+description+'. Release it manually; no process was terminated.');
      }
      const reply = await ask('Port '+conflict.port+' occupied by '+description+
        (belongs ? ' [same project]' : ' [another process]')+
        '. Send SIGTERM to this PID? (type YES to confirm): ');
      if (String(reply).trim() !== 'YES') throw new Error('Startup cancelled: port '+conflict.port+' is occupied.');
      // Do not kill a PID that changed identity while asking.
      const now = inspectLinux(conflict.port).find(p => p.pid === owner.pid);
      if (!now || now.command !== owner.command || now.cwd !== owner.cwd)
        throw new Error('The owning process changed; no signal was sent.');
      process.kill(owner.pid,'SIGTERM');
    }
  }
  for (let retry=0;retry<20;retry++) {
    if (!(await inspectPorts(ports)).length) return {reuse:false};
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw new Error('Ports remain occupied following authorized termination.');
}

/** @deprecated Never terminates processes. */
export async function clearPorts(...ports) { return assertPortsAvailable(...ports); }
