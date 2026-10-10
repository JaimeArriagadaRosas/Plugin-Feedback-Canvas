import { run } from '../runner.js';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const notFound = text => /no such (?:object|container)/i.test(text);
const detail = result => result.stderr || result.stdout || String(result.code || 'error desconocido');

/**
 * Ejecuta como máximo una orden de borrado. Docker puede completar la
 * eliminación después de que rm devuelva un error o venza su tiempo límite.
 * Nunca interpreta un fallo de conexión al daemon como una eliminación exitosa.
 */
export async function removeContainerAndWait({
  id, alreadyRemoving = false, execute = run, sleep = wait,
  onProgress = () => {}, pollMs = 2000, maxWaitMs = 120000
}) {
  const result = alreadyRemoving
    ? { ok: true, stdout: '', stderr: '', code: 0 }
    : await execute('docker', ['rm', '-f', id], { timeout: 90000 });
  let elapsedMs = 0;
  let lastState = 'desconocido';

  while (true) {
    const probe = await execute('docker', ['inspect', '--type', 'container',
      '--format', '{{.State.Status}}', id], { timeout: 12000 });
    if (!probe.ok) {
      const output = `${probe.stderr || ''} ${probe.stdout || ''}`;
      if (notFound(output)) return { completedAfterError: !result.ok, waitedMs: elapsedMs };
      throw new Error(`No se pudo verificar el estado del contenedor: ${detail(probe)}. ` +
        (result.ok ? '' : `El borrado original devolvió: ${detail(result)}`));
    }

    lastState = probe.stdout.trim() || 'desconocido';
    // Si rm falló por una causa distinta de una eliminación pendiente,
    // no hay razón para esperar ni lanzar otro rm.
    if (!result.ok && !['dead', 'removing'].includes(lastState)) {
      throw new Error(`Docker no pudo eliminar el contenedor (estado: ${lastState}). ` +
        `Causa informada: ${detail(result)}`);
    }
    if (elapsedMs >= maxWaitMs) {
      throw new Error(`La eliminación sigue pendiente tras ${Math.round(maxWaitMs / 1000)} s ` +
        `(estado: ${lastState}). No se repetirá docker rm. ` +
        (result.ok ? '' : `Detalle Docker: ${detail(result)}`));
    }
    onProgress({ state: lastState, elapsedMs });
    await sleep(pollMs);
    elapsedMs += pollMs;
  }
}
