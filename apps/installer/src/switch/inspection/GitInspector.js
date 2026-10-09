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
  const allowed = new Set(['main', 'english-version', 'feat/opcion-5-cambio-idioma']);
  if (!allowed.has(current)) throw new Error(`Rama no admitida para cambio: ${current}`);
  const destination = current === 'english-version' ? 'main' : 'english-version';
  if (status) throw new Error('Hay cambios locales sin confirmar. Se cancela sin modificar archivos:\n' + status.slice(0, 1200));
  const local = await run('git', ['show-ref', '--verify', '--quiet', `refs/heads/${destination}`], { cwd: root });
  const remoteBranch = await run('git', ['show-ref', '--verify', '--quiet', `refs/remotes/origin/${destination}`], { cwd: root });
  if (!local.ok && !remoteBranch.ok) throw new Error(`No está disponible ${destination}. Primero actualice las referencias remotas.`);
  const sourceLock = requireSuccess(await run('git', ['rev-parse', 'HEAD:package-lock.json'], { cwd: root }), 'Lockfile origen').stdout;
  const destinationLock = requireSuccess(await run('git', ['rev-parse', `${local.ok ? destination : 'origin/' + destination}:package-lock.json`], { cwd: root }), 'Lockfile destino').stdout;
  return { current, destination, localBranch: local.ok, lockfileChanged: sourceLock !== destinationLock, root };
}
