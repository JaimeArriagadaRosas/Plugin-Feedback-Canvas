import path from 'node:path';
import { run, requireSuccess } from '../runner.js';
export async function inspectGit(root) {
  const top = requireSuccess(await run('git', ['rev-parse', '--show-toplevel'], { cwd: root }), 'Git root').stdout;
  if (path.resolve(top) !== path.resolve(root)) throw new Error('La ruta indicada no es la raíz del repositorio.');
  const current = requireSuccess(await run('git', ['branch', '--show-current'], { cwd: root }), 'Rama').stdout;
  const status = requireSuccess(await run('git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: root }), 'Cambios locales').stdout;
  const remote = requireSuccess(await run('git', ['remote', 'get-url', 'origin'], { cwd: root }), 'Origen').stdout;
  if (!/^https:\/\/github\.com\/JaimeArriagadaRosas\/Plugin-Feedback-Canvas(?:\.git)?\/?$|^git@github\.com:JaimeArriagadaRosas\/Plugin-Feedback-Canvas(?:\.git)?$/.test(remote)) {
    throw new Error('El remoto origin no corresponde al repositorio autorizado.');
  }
  const allowed = new Set(['main', 'english-version']);
  if (!allowed.has(current)) throw new Error(`Rama no admitida para cambio: ${current}`);
  if (status) throw new Error('Hay cambios locales sin confirmar. Se cancela sin modificar archivos:\n' + status.slice(0, 1200));
  const destination = current === 'english-version' ? 'main' : 'english-version';
  const fetched = await run('git', ['fetch', '--no-tags', 'origin', `+refs/heads/${destination}:refs/remotes/origin/${destination}`], { cwd: root, timeout: 120000 });
  if (!fetched.ok) throw new Error(`No se pudo actualizar origin/${destination}; no se utilizará una referencia antigua: ${fetched.stderr}`);
  const local = await run('git', ['show-ref', '--verify', '--quiet', `refs/heads/${destination}`], { cwd: root });
  const sourceLock = requireSuccess(await run('git', ['rev-parse', 'HEAD:package-lock.json'], { cwd: root }), 'Lockfile origen').stdout;
  const destinationLock = requireSuccess(await run('git', ['rev-parse', `origin/${destination}:package-lock.json`], { cwd: root }), 'Lockfile destino').stdout;
  if (local.ok) {
    const localSha = requireSuccess(await run('git', ['rev-parse', destination], { cwd: root }), 'Revisión local').stdout;
    const remoteSha = requireSuccess(await run('git', ['rev-parse', `origin/${destination}`], { cwd: root }), 'Revisión remota').stdout;
    if (localSha !== remoteSha) throw new Error(`La rama local ${destination} difiere del remoto; se requiere revisión manual antes de cambiar.`);
  }
  return { current, destination, localBranch: local.ok, lockfileChanged: sourceLock !== destinationLock, root };
}
