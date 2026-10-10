import { inspectProcesses, stillOwned } from '../inspection/ProcessInspector.js';
import { confirmAction } from '../SwitchPrompt.js';
import { boot } from '../../orchestration/boot/logger.js';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function cleanProcesses(ctx) {
  const result = inspectProcesses(ctx.root);
  if (!result.supported) {
    boot.warn('Host process inspection is not implemented for this platform; no host process will be terminated automatically.');
    return;
  }
  for (const item of result.processes) {
    if (!stillOwned(item.pid, item.startTime, ctx.root)) continue;
    if (!await confirmAction({ title: 'Stop old plugin process',
      detail: `PID ${item.pid} | executable: ${item.command}. SIGTERM will be sent only to this workspace process.` }))
      throw new Error('Cleanup of process ' + item.pid + ' declined.');
    if (!stillOwned(item.pid, item.startTime, ctx.root)) continue;
    try { process.kill(item.pid, 'SIGTERM'); }
    catch(e) { if (e.code !== 'ESRCH') throw e; }
    for (let tries = 0; tries < 15 && stillOwned(item.pid, item.startTime, ctx.root); tries++) await sleep(250);
    if (stillOwned(item.pid, item.startTime, ctx.root)) throw new Error('Process ' + item.pid + ' did not exit after SIGTERM. No privileges or SIGKILL will be used without separate approval.');
    boot.success('Process stopped: ' + item.pid);
  }
}
