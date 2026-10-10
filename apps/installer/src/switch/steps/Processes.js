import { inspectProcesses, stillOwned } from '../inspection/ProcessInspector.js';
import { confirmAction } from '../SwitchPrompt.js';
import { boot } from '../../orchestration/boot/logger.js';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function cleanProcesses(ctx) {
  const result = inspectProcesses(ctx.root);
  if (!result.supported) {
    boot.warn('Inspección de procesos del host no implementada para este sistema; no se terminará ningún proceso automáticamente.');
    return;
  }
  for (const item of result.processes) {
    if (!stillOwned(item.pid, item.startTime, ctx.root)) continue;
    if (!await confirmAction({ title: 'Detener proceso antiguo del plugin',
      detail: `PID ${item.pid} | ejecutable: ${item.command}. Se enviará SIGTERM únicamente a este proceso del workspace.` }))
      throw new Error('Limpieza del proceso ' + item.pid + ' rechazada.');
    if (!stillOwned(item.pid, item.startTime, ctx.root)) continue;
    try { process.kill(item.pid, 'SIGTERM'); }
    catch(e) { if (e.code !== 'ESRCH') throw e; }
    for (let tries = 0; tries < 15 && stillOwned(item.pid, item.startTime, ctx.root); tries++) await sleep(250);
    if (stillOwned(item.pid, item.startTime, ctx.root)) throw new Error('El proceso ' + item.pid + ' no terminó tras SIGTERM. No se usarán privilegios ni SIGKILL sin otra autorización.');
    boot.success('Proceso finalizado: ' + item.pid);
  }
}
